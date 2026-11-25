import type { Table } from 'dexie';
import type { BaseDatos } from '../db/baseDatos';
import type { ComprobantePago } from '../db/tipos';
import {
  ErrorConflicto,
  ErrorValidacion,
} from '../dominio/errores';
import { esUuid } from '../dominio/ids';
import {
  FORMATO,
  FORMAT_VERSION,
  SCHEMA_VERSION,
  type ComprobanteExportado,
  type PaqueteQoriGo,
} from './respaldo';

export type ModoImportacion = 'REEMPLAZAR' | 'COMBINAR';

export type NombreColeccion = keyof PaqueteQoriGo['data'];

export const COLECCIONES: NombreColeccion[] = [
  'personas',
  'monedas',
  'plataformas',
  'suscripciones',
  'costosSuscripcionPeriodo',
  'miembrosSuscripcion',
  'cargosSuscripcion',
  'prestamos',
  'cuotasPrestamo',
  'cuotaAjustes',
  'pagos',
  'aplicacionesPago',
  'comprobantes',
  'configuracion',
  'auditoria',
];

export interface PrevisualizacionImportacion {
  valido: boolean;
  errores: string[];
  advertencias: string[];
  formato?: string;
  formatVersion?: number;
  schemaVersion?: number;
  appVersion?: string;
  exportedAt?: string;
  conteos: Record<string, number>;
}

export interface ResultadoImportacion {
  modo: ModoImportacion;
  importados: Record<string, number>;
  omitidos: Record<string, number>;
  totales: Record<string, number>;
}

export interface OpcionesImportacion {
  modo: ModoImportacion;
  /** Hook de integración para simular fallos durante la transacción. */
  alInsertar?: (coleccion: NombreColeccion, indice: number) => void | Promise<void>;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function aBase64Bytes(base64: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    return null;
  }
  try {
    const binario = atob(base64);
    return Uint8Array.from(binario, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function validarComprobante(
  comprobante: ComprobanteExportado,
  errores: string[],
): void {
  if (typeof comprobante.imagenBase64 !== 'string') {
    errores.push(`Comprobante ${comprobante.id}: falta imagenBase64.`);
    return;
  }
  const bytes = aBase64Bytes(comprobante.imagenBase64);
  if (!bytes) {
    errores.push(`Comprobante ${comprobante.id}: Base64 inválido.`);
    return;
  }
  const firmaPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || firmaPng.some((valor, i) => bytes[i] !== valor)) {
    errores.push(`Comprobante ${comprobante.id}: no es un PNG válido.`);
    return;
  }
  const vista = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
  const ancho = vista.getUint32(16);
  const alto = vista.getUint32(20);
  if (ancho !== comprobante.ancho || alto !== comprobante.alto) {
    errores.push(
      `Comprobante ${comprobante.id}: las dimensiones no coinciden con la imagen.`,
    );
  }
  if (comprobante.mimeType !== 'image/png') {
    errores.push(`Comprobante ${comprobante.id}: el MIME debe ser image/png.`);
  }
}

function validarReferencias(
  paquete: PaqueteQoriGo,
  errores: string[],
): void {
  const ids = (coleccion: NombreColeccion): Set<string> =>
    new Set(
      (paquete.data[coleccion] as unknown as Array<Record<string, unknown>>).map(
        (registro) =>
          String(
            registro.id ?? registro.clave ?? registro.codigo ?? '',
          ),
      ),
    );

  const personas = ids('personas');
  const monedas = ids('monedas');
  const plataformas = ids('plataformas');
  const suscripciones = ids('suscripciones');
  const miembros = ids('miembrosSuscripcion');
  const cargos = ids('cargosSuscripcion');
  const prestamos = ids('prestamos');
  const cuotas = ids('cuotasPrestamo');
  const pagos = ids('pagos');

  const requerido = (
    valor: string,
    conjunto: Set<string>,
    mensaje: string,
  ) => {
    if (!conjunto.has(valor)) errores.push(mensaje);
  };

  for (const referencia of paquete.data.suscripciones) {
    requerido(
      referencia.plataformaId,
      plataformas,
      `Suscripción ${referencia.id}: plataforma inexistente.`,
    );
    requerido(
      referencia.moneda,
      monedas,
      `Suscripción ${referencia.id}: moneda inexistente.`,
    );
  }
  for (const referencia of paquete.data.miembrosSuscripcion) {
    requerido(
      referencia.suscripcionId,
      suscripciones,
      `Membresía ${referencia.id}: suscripción inexistente.`,
    );
    requerido(
      referencia.personaId,
      personas,
      `Membresía ${referencia.id}: persona inexistente.`,
    );
  }
  for (const referencia of paquete.data.cargosSuscripcion) {
    requerido(
      referencia.miembroId,
      miembros,
      `Cargo ${referencia.id}: membresía inexistente.`,
    );
  }
  for (const referencia of paquete.data.prestamos) {
    requerido(
      referencia.personaId,
      personas,
      `Préstamo ${referencia.id}: persona inexistente.`,
    );
    requerido(
      referencia.moneda,
      monedas,
      `Préstamo ${referencia.id}: moneda inexistente.`,
    );
  }
  for (const referencia of paquete.data.cuotasPrestamo) {
    requerido(
      referencia.prestamoId,
      prestamos,
      `Cuota ${referencia.id}: préstamo inexistente.`,
    );
  }
  for (const referencia of paquete.data.cuotaAjustes) {
    requerido(
      referencia.cuotaId,
      cuotas,
      `Ajuste ${referencia.id}: cuota inexistente.`,
    );
  }
  for (const referencia of paquete.data.pagos) {
    requerido(
      referencia.personaId,
      personas,
      `Pago ${referencia.id}: persona inexistente.`,
    );
    requerido(
      referencia.moneda,
      monedas,
      `Pago ${referencia.id}: moneda inexistente.`,
    );
  }
  for (const referencia of paquete.data.costosSuscripcionPeriodo) {
    requerido(
      referencia.suscripcionId,
      suscripciones,
      `Costo ${referencia.id}: suscripción inexistente.`,
    );
  }
  for (const referencia of paquete.data.aplicacionesPago) {
    requerido(
      referencia.pagoId,
      pagos,
      `Aplicación ${referencia.id}: pago inexistente.`,
    );
    const tieneCargo = Boolean(referencia.cargoId);
    const tieneCuota = Boolean(referencia.cuotaId);
    if (tieneCargo === tieneCuota) {
      errores.push(
        `Aplicación ${referencia.id}: debe apuntar a un cargo o a una cuota, no a ambos.`,
      );
    }
    if (referencia.cargoId) {
      requerido(
        referencia.cargoId,
        cargos,
        `Aplicación ${referencia.id}: cargo inexistente.`,
      );
    }
    if (referencia.cuotaId) {
      requerido(
        referencia.cuotaId,
        cuotas,
        `Aplicación ${referencia.id}: cuota inexistente.`,
      );
    }
  }
  for (const referencia of paquete.data.comprobantes) {
    requerido(
      referencia.pagoId,
      pagos,
      `Comprobante ${referencia.id}: pago inexistente.`,
    );
    validarComprobante(referencia, errores);
  }
}

/** Valida el paquete completo sin escribir nada. */
export function validarPaquete(datos: unknown): {
  paquete: PaqueteQoriGo | null;
  errores: string[];
  advertencias: string[];
} {
  const errores: string[] = [];
  const advertencias: string[] = [];

  if (!esObjeto(datos)) {
    return {
      paquete: null,
      errores: ['El archivo no contiene un objeto JSON válido.'],
      advertencias,
    };
  }
  if (datos.format !== FORMATO) {
    errores.push('El archivo no es un respaldo de QoriGo.');
  }
  if (typeof datos.formatVersion !== 'number') {
    errores.push('Falta la versión del formato.');
  } else if (datos.formatVersion > FORMAT_VERSION) {
    errores.push(
      `La versión del formato (${datos.formatVersion}) es más nueva que la soportada (${FORMAT_VERSION}).`,
    );
  }
  if (
    typeof datos.schemaVersion === 'number' &&
    datos.schemaVersion > SCHEMA_VERSION
  ) {
    errores.push(
      `La versión del esquema (${datos.schemaVersion}) no está soportada.`,
    );
  }
  if (!esObjeto(datos.data)) {
    errores.push('El paquete no contiene la sección de datos.');
  }

  if (errores.length > 0 || !esObjeto(datos.data)) {
    return { paquete: null, errores, advertencias };
  }

  const data = datos.data as Record<string, unknown>;
  for (const coleccion of COLECCIONES) {
    if (!Array.isArray(data[coleccion])) {
      errores.push(`Falta la colección "${coleccion}".`);
    }
  }
  if (errores.length > 0) {
    return { paquete: null, errores, advertencias };
  }

  const paquete = datos as unknown as PaqueteQoriGo;

  for (const coleccion of COLECCIONES) {
    const registros = paquete.data[coleccion] as unknown as Array<
      Record<string, unknown>
    >;
    const vistos = new Set<string>();
    for (const registro of registros) {
      const esConfiguracion = coleccion === 'configuracion';
      const esMoneda = coleccion === 'monedas';
      const clave = String(
        esConfiguracion
          ? registro.clave
          : esMoneda
            ? registro.codigo
            : registro.id,
      );
      if (!clave) {
        errores.push(`Registro sin identificador en "${coleccion}".`);
        continue;
      }
      if (!esConfiguracion && !esMoneda && !esUuid(clave)) {
        errores.push(`Identificador no UUID en "${coleccion}": ${clave}`);
      }
      if (vistos.has(clave)) {
        errores.push(`Identificador duplicado en "${coleccion}": ${clave}`);
      }
      vistos.add(clave);
    }
  }

  if (errores.length === 0) validarReferencias(paquete, errores);

  if (paquete.data.personas.length === 0) {
    advertencias.push('El paquete no contiene personas.');
  }
  if (paquete.data.comprobantes.length > 0) {
    advertencias.push(
      'El paquete contiene imágenes de comprobantes que se guardarán en este dispositivo.',
    );
  }

  return {
    paquete: errores.length === 0 ? paquete : null,
    errores,
    advertencias,
  };
}

export function previsualizarImportacion(
  datos: unknown,
): PrevisualizacionImportacion {
  const { paquete, errores, advertencias } = validarPaquete(datos);
  const conteos: Record<string, number> = {};
  if (paquete) {
    for (const coleccion of COLECCIONES) {
      conteos[coleccion] = (
        paquete.data[coleccion] as unknown as unknown[]
      ).length;
    }
  }
  return {
    valido: errores.length === 0,
    errores,
    advertencias,
    formato: paquete?.format,
    formatVersion: paquete?.formatVersion,
    schemaVersion: paquete?.schemaVersion,
    appVersion: paquete?.appVersion,
    exportedAt: paquete?.exportedAt,
    conteos,
  };
}

/* -------------------- Comparación para combinar ---------------------- */

function esIndefinido(valor: unknown): boolean {
  return valor === undefined;
}

function canonico(valor: unknown): string {
  if (esIndefinido(valor)) return 'null';
  if (Array.isArray(valor)) {
    return `[${valor.map(canonico).join(',')}]`;
  }
  if (esObjeto(valor)) {
    return `{${Object.keys(valor)
      .filter((clave) => !esIndefinido(valor[clave]))
      .sort()
      .map((clave) => `${JSON.stringify(clave)}:${canonico(valor[clave])}`)
      .join(',')}}`;
  }
  return JSON.stringify(valor);
}

function sonIguales(
  coleccion: NombreColeccion,
  local: Record<string, unknown>,
  paquete: Record<string, unknown>,
): boolean {
  if (coleccion === 'comprobantes') {
    return (
      local.sha256 === paquete.sha256 &&
      local.mimeType === paquete.mimeType &&
      local.ancho === paquete.ancho &&
      local.alto === paquete.alto
    );
  }
  return canonico(local) === canonico(paquete);
}

function claveDePrimaria(
  coleccion: NombreColeccion,
  registro: Record<string, unknown>,
): string {
  if (coleccion === 'configuracion') return String(registro.clave);
  if (coleccion === 'monedas') return String(registro.codigo);
  return String(registro.id);
}

async function comprobantesLocales(
  db: BaseDatos,
): Promise<Map<string, Record<string, unknown>>> {
  const registros = await db.comprobantesPago.toArray();
  return new Map(
    registros.map((registro) => [
      registro.id,
      {
        id: registro.id,
        pagoId: registro.pagoId,
        mimeType: registro.mimeType,
        ancho: registro.ancho,
        alto: registro.alto,
        sha256: registro.sha256,
        subidoEn: registro.subidoEn,
      },
    ]),
  );
}

function aComprobantePago(
  comprobante: ComprobanteExportado,
): ComprobantePago {
  const bytes = aBase64Bytes(comprobante.imagenBase64)!;
  return {
    id: comprobante.id,
    pagoId: comprobante.pagoId,
    imagen: new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
    mimeType: comprobante.mimeType,
    ancho: comprobante.ancho,
    alto: comprobante.alto,
    sha256: comprobante.sha256,
    subidoEn: comprobante.subidoEn,
  };
}

/**
 * CU-26. Aplica un paquete validado. En una sola transacción: reemplaza todo
 * el conjunto de datos o incorpora solo los registros nuevos por UUID.
 * Un conflicto de contenido cancela la importación sin sobrescribir nada.
 */
export async function importarDatos(
  db: BaseDatos,
  datos: unknown,
  opciones: OpcionesImportacion,
): Promise<ResultadoImportacion> {
  const { paquete, errores } = validarPaquete(datos);
  if (!paquete) {
    throw new ErrorValidacion(errores[0] ?? 'El paquete no es válido.');
  }
  const modo = opciones.modo;
  const importados: Record<string, number> = {};
  const omitidos: Record<string, number> = {};
  const totales: Record<string, number> = {};
  const agregados: Record<string, unknown[]> = {};

  for (const coleccion of COLECCIONES) {
    const registros = paquete.data[coleccion] as unknown as Array<
      Record<string, unknown>
    >;
    totales[coleccion] = registros.length;
    importados[coleccion] = 0;
    omitidos[coleccion] = 0;
    agregados[coleccion] = [];
  }

  if (modo === 'COMBINAR') {
    const localesComprobantes = await comprobantesLocales(db);
    for (const coleccion of COLECCIONES) {
      const tabla = tablaDe(db, coleccion);
      const locales = await tabla.toArray();
      const mapa = new Map(
        locales.map((registro) => [
          claveDePrimaria(
            coleccion,
            registro as unknown as Record<string, unknown>,
          ),
          registro as unknown as Record<string, unknown>,
        ]),
      );
      const registros = paquete.data[coleccion] as unknown as Array<
        Record<string, unknown>
      >;
      for (const registro of registros) {
        const clave = claveDePrimaria(coleccion, registro);
        const local =
          coleccion === 'comprobantes'
            ? localesComprobantes.get(clave)
            : mapa.get(clave);
        if (!local) {
          agregados[coleccion].push(registro);
          importados[coleccion] += 1;
        } else if (sonIguales(coleccion, local, registro)) {
          omitidos[coleccion] += 1;
        } else {
          throw new ErrorConflicto(
            `El registro ${clave} de "${coleccion}" existe con otro contenido. La importación se canceló.`,
          );
        }
      }
    }
  } else {
    for (const coleccion of COLECCIONES) {
      const registros = paquete.data[coleccion] as unknown as Array<
        Record<string, unknown>
      >;
      agregados[coleccion] = [...registros];
      importados[coleccion] = registros.length;
    }
  }

  const tablas = COLECCIONES.map((coleccion) => tablaDe(db, coleccion));
  const configuracionLocal =
    modo === 'REEMPLAZAR'
      ? (await db.configuracion.toArray()).filter(
          (registro) =>
            registro.clave === 'acceso_configurado' ||
            registro.clave.startsWith('acceso_'),
        )
      : [];

  await db.transaction('rw', tablas, async () => {
    if (modo === 'REEMPLAZAR') {
      for (const coleccion of COLECCIONES) {
        await tablaDe(db, coleccion).clear();
      }
    }
    for (const coleccion of COLECCIONES) {
      const registros = agregados[coleccion];
      for (let i = 0; i < registros.length; i++) {
        await opciones.alInsertar?.(coleccion, i);
        if (coleccion === 'comprobantes') {
          await db.comprobantesPago.add(
            aComprobantePago(registros[i] as unknown as ComprobanteExportado),
          );
        } else {
          await tablaDe(db, coleccion).add(
            registros[i] as Record<string, unknown>,
          );
        }
      }
    }
    for (const registro of configuracionLocal) {
      await db.configuracion.put(registro);
    }
  });

  return { modo, importados, omitidos, totales };
}

function tablaDe(
  db: BaseDatos,
  coleccion: NombreColeccion,
): Table<Record<string, unknown>, string> {
  const tabla = (() => {
    switch (coleccion) {
      case 'personas':
        return db.personas;
      case 'monedas':
        return db.monedas;
      case 'plataformas':
        return db.plataformas;
      case 'suscripciones':
        return db.suscripciones;
      case 'costosSuscripcionPeriodo':
        return db.costosSuscripcionPeriodo;
      case 'miembrosSuscripcion':
        return db.miembrosSuscripcion;
      case 'cargosSuscripcion':
        return db.cargosSuscripcion;
      case 'prestamos':
        return db.prestamos;
      case 'cuotasPrestamo':
        return db.cuotasPrestamo;
      case 'cuotaAjustes':
        return db.cuotaAjustes;
      case 'pagos':
        return db.pagos;
      case 'aplicacionesPago':
        return db.aplicacionesPago;
      case 'comprobantes':
        return db.comprobantesPago;
      case 'configuracion':
        return db.configuracion;
      case 'auditoria':
        return db.auditoria;
    }
  })();
  return tabla as unknown as Table<Record<string, unknown>, string>;
}
