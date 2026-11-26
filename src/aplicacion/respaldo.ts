import type { DatosQoriGo } from './puertos/persistencia';
import type {
  AplicacionPago,
  AuditoriaRegistro,
  CargoSuscripcion,
  Configuracion,
  CostoSuscripcionPeriodo,
  CuotaAjuste,
  CuotaPrestamo,
  MiembroSuscripcion,
  Moneda,
  Pago,
  Persona,
  Plataforma,
  Prestamo,
  Suscripcion,
} from '../dominio/modelo';
import { comprobanteABase64 } from './comprobantes';

export const FORMATO = 'qorigo-data';
export const FORMAT_VERSION = 1;
export const SCHEMA_VERSION = 1;
export const APP_VERSION = '1.0.0';

export const ADVERTENCIA_EXPORTACION =
  'El archivo puede contener datos personales, financieros e imágenes. Guárdalo en un lugar seguro y compártelo solo con quien deba verlo.';

export interface ComprobanteExportado {
  id: string;
  pagoId: string;
  imagenBase64: string;
  mimeType: string;
  ancho: number;
  alto: number;
  sha256: string;
  subidoEn: string;
}

export interface DatosExportados {
  personas: Persona[];
  monedas: Moneda[];
  plataformas: Plataforma[];
  suscripciones: Suscripcion[];
  costosSuscripcionPeriodo: CostoSuscripcionPeriodo[];
  miembrosSuscripcion: MiembroSuscripcion[];
  cargosSuscripcion: CargoSuscripcion[];
  prestamos: Prestamo[];
  cuotasPrestamo: CuotaPrestamo[];
  cuotaAjustes: CuotaAjuste[];
  pagos: Pago[];
  aplicacionesPago: AplicacionPago[];
  comprobantes: ComprobanteExportado[];
  configuracion: Configuracion[];
  auditoria: AuditoriaRegistro[];
}

export interface PaqueteQoriGo {
  format: typeof FORMATO;
  formatVersion: number;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  timezone: string;
  currencies: string[];
  data: DatosExportados;
}

/** Claves locales que no se transportan (acceso y credenciales). */
export function configuracionExportable(
  configuracion: Configuracion[],
): Configuracion[] {
  return configuracion.filter(
    (registro) =>
      registro.clave !== 'acceso_configurado' &&
      !registro.clave.startsWith('acceso_'),
  );
}

/**
 * CU-25. Construye una copia transportable. No modifica la base local ni
 * transmite nada a un servidor. Las credenciales de acceso local no se
 * exportan.
 */
export async function exportarDatos(db: DatosQoriGo): Promise<PaqueteQoriGo> {
  const [
    personas,
    monedas,
    plataformas,
    suscripciones,
    costos,
    miembros,
    cargos,
    prestamos,
    cuotas,
    ajustes,
    pagos,
    aplicaciones,
    comprobantes,
    configuracion,
    auditoria,
  ] = await Promise.all([
    db.personas.toArray(),
    db.monedas.toArray(),
    db.plataformas.toArray(),
    db.suscripciones.toArray(),
    db.costosSuscripcionPeriodo.toArray(),
    db.miembrosSuscripcion.toArray(),
    db.cargosSuscripcion.toArray(),
    db.prestamos.toArray(),
    db.cuotasPrestamo.toArray(),
    db.cuotaAjustes.toArray(),
    db.pagos.toArray(),
    db.aplicacionesPago.toArray(),
    db.comprobantesPago.toArray(),
    db.configuracion.toArray(),
    db.auditoria.toArray(),
  ]);

  const comprobantesExportados: ComprobanteExportado[] = [];
  for (const comprobante of comprobantes) {
    comprobantesExportados.push({
      id: comprobante.id,
      pagoId: comprobante.pagoId,
      imagenBase64: await comprobanteABase64(comprobante.imagen),
      mimeType: comprobante.mimeType,
      ancho: comprobante.ancho,
      alto: comprobante.alto,
      sha256: comprobante.sha256,
      subidoEn: comprobante.subidoEn,
    });
  }

  return {
    format: FORMATO,
    formatVersion: FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    timezone: 'America/Lima',
    currencies: monedas.map((m) => m.codigo).sort(),
    data: {
      personas,
      monedas,
      plataformas,
      suscripciones,
      costosSuscripcionPeriodo: costos,
      miembrosSuscripcion: miembros,
      cargosSuscripcion: cargos,
      prestamos,
      cuotasPrestamo: cuotas,
      cuotaAjustes: ajustes,
      pagos,
      aplicacionesPago: aplicaciones,
      comprobantes: comprobantesExportados,
      configuracion: configuracionExportable(configuracion),
      auditoria: auditoria.filter((registro) => registro.entidad !== 'USUARIO'),
    },
  };
}

export function serializarPaquete(paquete: PaqueteQoriGo): string {
  return JSON.stringify(paquete, null, 2);
}

export function nombreArchivoExportacion(fecha = new Date()): string {
  const iso = fecha.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `qorigo-${iso}.json`;
}
