import type { BaseDatos } from '../db/baseDatos';
import type {
  MiembroSuscripcion,
  Pago,
  Persona,
  Prestamo,
  Suscripcion,
} from '../db/tipos';
import { auditar } from '../db/auditoria';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorReglaNegocio,
  ErrorValidacion,
} from '../dominio/errores';
import { nuevoId } from '../dominio/ids';
import { normalizar } from '../dominio/normalizar';
import { nombreCompleto, nombreNormalizado } from '../dominio/nombres';
import { paginar, type Pagina } from './pagina';
import { cargarAuxiliaresSaldos, pagadoDeCargo, pagadoDeCuota } from './saldos';

export interface EntradaPersona {
  nombres: string;
  apellidos: string;
  documento?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
}

export type ResolucionSimilar = 'crear' | 'reutilizar';

export interface OpcionesRegistro {
  /** Solo se usa cuando ya se mostró la alerta de nombres similares. */
  resolucionSimilar?: ResolucionSimilar;
}

export type EstadoRegistro = 'CREADA' | 'REUTILIZADA' | 'REQUIERE_DECISION';

export interface ResultadoRegistroPersona {
  estado: EstadoRegistro;
  persona: Persona | null;
  similares: Persona[];
}

export class ErrorDocumentoDuplicado extends ErrorConflicto {
  constructor(public readonly persona: Persona) {
    super(
      `El documento ya está registrado para ${nombreCompleto(persona.nombres, persona.apellidos)}.`,
    );
    this.name = 'ErrorDocumentoDuplicado';
  }
}

function limpiar(valor?: string): string | undefined {
  const texto = valor?.trim();
  return texto ? texto : undefined;
}

function distanciaLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const actual = fila[j];
      fila[j] = Math.min(
        fila[j] + 1,
        fila[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      anterior = actual;
    }
  }
  return fila[b.length];
}

/** Considera similares los nombres iguales o los que comparten apellidos. */
export function sonSimilares(a: Persona, b: EntradaPersona): boolean {
  const normA = normalizar(nombreCompleto(a.nombres, a.apellidos));
  const normB = normalizar(nombreCompleto(b.nombres, b.apellidos));
  if (normA === normB) return true;

  const apellidosA = normalizar(a.apellidos);
  const apellidosB = normalizar(b.apellidos);
  if (apellidosA && apellidosA === apellidosB) return true;

  const nombreA = normalizar(a.nombres).split(' ')[0] ?? '';
  const nombreB = normalizar(b.nombres).split(' ')[0] ?? '';
  return (
    nombreA.length > 2 &&
    nombreB.length > 2 &&
    distanciaLevenshtein(nombreA, nombreB) <= 2
  );
}

export async function buscarPorDocumento(
  db: BaseDatos,
  documento: string,
): Promise<Persona | undefined> {
  const limpio = documento.trim();
  if (!limpio) return undefined;
  return db.personas.where('documento').equals(limpio).first();
}

export async function buscarSimilares(
  db: BaseDatos,
  entrada: EntradaPersona,
): Promise<Persona[]> {
  const personas = await db.personas.toArray();
  return personas.filter((persona) => sonSimilares(persona, entrada));
}

function validar(entrada: EntradaPersona): {
  nombres: string;
  apellidos: string;
  documento?: string;
} {
  const nombres = entrada.nombres?.trim() ?? '';
  const apellidos = entrada.apellidos?.trim() ?? '';
  if (!nombres) {
    throw new ErrorValidacion('Los nombres son obligatorios.', 'nombres');
  }
  if (!apellidos) {
    throw new ErrorValidacion('Los apellidos son obligatorios.', 'apellidos');
  }
  const documento = limpiar(entrada.documento);
  if (documento && !/^[A-Za-z0-9-]{4,20}$/.test(documento)) {
    throw new ErrorValidacion(
      'El documento debe tener entre 4 y 20 caracteres alfanuméricos.',
      'documento',
    );
  }
  const email = limpiar(entrada.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErrorValidacion('El correo no tiene un formato válido.', 'email');
  }
  return { nombres, apellidos, documento };
}

/**
 * CU-01. Alta de persona con control de documento duplicado y alerta de
 * nombres similares. La decisión de similitud se resuelve explícitamente.
 */
export async function registrarPersona(
  db: BaseDatos,
  entrada: EntradaPersona,
  opciones: OpcionesRegistro = {},
): Promise<ResultadoRegistroPersona> {
  const { nombres, apellidos, documento } = validar(entrada);

  if (documento) {
    const existente = await buscarPorDocumento(db, documento);
    if (existente) throw new ErrorDocumentoDuplicado(existente);
  }

  const similares = await buscarSimilares(db, { ...entrada, nombres, apellidos });

  if (
    similares.length > 0 &&
    !opciones.resolucionSimilar
  ) {
    return { estado: 'REQUIERE_DECISION', persona: null, similares };
  }

  if (opciones.resolucionSimilar === 'reutilizar') {
    if (similares.length === 0) {
      throw new ErrorValidacion(
        'No hay una persona similar para reutilizar.',
      );
    }
    return { estado: 'REUTILIZADA', persona: similares[0], similares };
  }

  const persona: Persona = {
    id: nuevoId(),
    nombres,
    apellidos,
    nombreNormalizado: nombreNormalizado(nombres, apellidos),
    documento,
    telefono: limpiar(entrada.telefono),
    email: limpiar(entrada.email),
    direccion: limpiar(entrada.direccion),
    activo: true,
    creadoEn: new Date().toISOString(),
  };

  await db.transaction('rw', db.personas, db.auditoria, async () => {
    await db.personas.add(persona);
    await auditar(db, {
      entidad: 'PERSONA',
      entidadId: persona.id,
      accion: 'CREAR',
      despues: persona,
    });
  });

  return { estado: 'CREADA', persona, similares };
}

/* ------------------------------- CU-02 ------------------------------- */

export type FiltroEstadoPersona = 'TODAS' | 'ACTIVAS' | 'INACTIVAS';

export interface FiltroPersonas {
  busqueda?: string;
  estado?: FiltroEstadoPersona;
  pagina?: number;
  tamano?: number;
}

export async function obtenerPersona(
  db: BaseDatos,
  id: string,
): Promise<Persona> {
  const persona = await db.personas.get(id);
  if (!persona) throw new ErrorNoEncontrado('La persona no existe.');
  return persona;
}

export async function listarPersonas(
  db: BaseDatos,
  filtro: FiltroPersonas = {},
): Promise<Pagina<Persona>> {
  const busqueda = normalizar(filtro.busqueda ?? '');
  const estado = filtro.estado ?? 'TODAS';
  const personas = await db.personas.toArray();
  const filtradas = personas
    .filter((persona) => {
      if (estado === 'ACTIVAS' && !persona.activo) return false;
      if (estado === 'INACTIVAS' && persona.activo) return false;
      if (!busqueda) return true;
      return normalizar(
        `${persona.nombres} ${persona.apellidos} ${persona.documento ?? ''}`,
      ).includes(busqueda);
    })
    .sort((a, b) =>
      nombreCompleto(a.apellidos, a.nombres).localeCompare(
        nombreCompleto(b.apellidos, b.nombres),
        'es',
      ),
    );
  return paginar(filtradas, filtro.pagina, filtro.tamano);
}

export async function editarPersona(
  db: BaseDatos,
  id: string,
  cambios: Partial<EntradaPersona>,
): Promise<Persona> {
  const anterior = await obtenerPersona(db, id);
  const nombres = (cambios.nombres ?? anterior.nombres).trim();
  const apellidos = (cambios.apellidos ?? anterior.apellidos).trim();
  if (!nombres) {
    throw new ErrorValidacion('Los nombres son obligatorios.', 'nombres');
  }
  if (!apellidos) {
    throw new ErrorValidacion('Los apellidos son obligatorios.', 'apellidos');
  }

  const documento = limpiar(
    cambios.documento !== undefined ? cambios.documento : anterior.documento,
  );
  if (documento && documento !== anterior.documento) {
    const duplicado = await buscarPorDocumento(db, documento);
    if (duplicado && duplicado.id !== id) {
      throw new ErrorDocumentoDuplicado(duplicado);
    }
  }

  const actualizada: Persona = {
    ...anterior,
    nombres,
    apellidos,
    nombreNormalizado: nombreNormalizado(nombres, apellidos),
    documento,
    telefono:
      cambios.telefono !== undefined
        ? limpiar(cambios.telefono)
        : anterior.telefono,
    email: cambios.email !== undefined ? limpiar(cambios.email) : anterior.email,
    direccion:
      cambios.direccion !== undefined
        ? limpiar(cambios.direccion)
        : anterior.direccion,
  };

  await db.transaction('rw', db.personas, db.auditoria, async () => {
    await db.personas.put(actualizada);
    await auditar(db, {
      entidad: 'PERSONA',
      entidadId: id,
      accion: 'ACTUALIZAR',
      antes: anterior,
      despues: actualizada,
    });
  });

  return actualizada;
}

export async function desactivarPersona(
  db: BaseDatos,
  id: string,
): Promise<Persona> {
  const anterior = await obtenerPersona(db, id);
  if (!anterior.activo) return anterior;
  const actualizada: Persona = { ...anterior, activo: false };
  await db.transaction('rw', db.personas, db.auditoria, async () => {
    await db.personas.put(actualizada);
    await auditar(db, {
      entidad: 'PERSONA',
      entidadId: id,
      accion: 'DESACTIVAR',
      antes: anterior,
      despues: actualizada,
    });
  });
  return actualizada;
}

export async function reactivarPersona(
  db: BaseDatos,
  id: string,
): Promise<Persona> {
  const anterior = await obtenerPersona(db, id);
  if (anterior.activo) return anterior;
  const actualizada: Persona = { ...anterior, activo: true };
  await db.transaction('rw', db.personas, db.auditoria, async () => {
    await db.personas.put(actualizada);
    await auditar(db, {
      entidad: 'PERSONA',
      entidadId: id,
      accion: 'REACTIVAR',
      antes: anterior,
      despues: actualizada,
    });
  });
  return actualizada;
}

/** Cuenta membresías, préstamos y pagos que impiden borrar una persona. */
export async function movimientosDePersona(
  db: BaseDatos,
  id: string,
): Promise<number> {
  const [miembros, prestamos, pagos] = await Promise.all([
    db.miembrosSuscripcion.where('personaId').equals(id).count(),
    db.prestamos.where('personaId').equals(id).count(),
    db.pagos.where('personaId').equals(id).count(),
  ]);
  return miembros + prestamos + pagos;
}

export async function eliminarPersona(
  db: BaseDatos,
  id: string,
): Promise<void> {
  const persona = await obtenerPersona(db, id);
  if ((await movimientosDePersona(db, id)) > 0) {
    throw new ErrorReglaNegocio(
      'La persona tiene movimientos. Solo se puede desactivar.',
    );
  }
  await db.transaction('rw', db.personas, db.auditoria, async () => {
    await db.personas.delete(id);
    await auditar(db, {
      entidad: 'PERSONA',
      entidadId: id,
      accion: 'ELIMINAR',
      antes: persona,
    });
  });
}

export interface SuscripcionDePersona {
  miembro: MiembroSuscripcion;
  suscripcion: Suscripcion;
  saldoCentimos: number;
}

export interface FichaPersona {
  persona: Persona;
  suscripciones: SuscripcionDePersona[];
  prestamos: Prestamo[];
  deudaPorMoneda: Array<{ moneda: string; centimos: number }>;
  pagosRecientes: Pago[];
}

export async function consultarFichaPersona(
  db: BaseDatos,
  id: string,
): Promise<FichaPersona> {
  const persona = await obtenerPersona(db, id);
  const aux = await cargarAuxiliaresSaldos(db);
  const miembros = await db.miembrosSuscripcion
    .where('personaId')
    .equals(id)
    .toArray();
  const prestamos = await db.prestamos.where('personaId').equals(id).toArray();
  const pagos = await db.pagos.where('personaId').equals(id).toArray();

  const deuda = new Map<string, number>();
  const suscripciones: SuscripcionDePersona[] = [];

  for (const miembro of miembros) {
    const suscripcion = await db.suscripciones.get(miembro.suscripcionId);
    if (!suscripcion) continue;
    const cargos = await db.cargosSuscripcion
      .where('miembroId')
      .equals(miembro.id)
      .toArray();
    const saldo = cargos
      .filter((c) => c.estado !== 'ANULADO')
      .reduce(
        (total, cargo) =>
          total +
          Math.max(0, cargo.montoCentimos - pagadoDeCargo(aux, cargo.id)),
        0,
      );
    if (saldo > 0) {
      deuda.set(
        suscripcion.moneda,
        (deuda.get(suscripcion.moneda) ?? 0) + saldo,
      );
    }
    suscripciones.push({ miembro, suscripcion, saldoCentimos: saldo });
  }

  for (const prestamo of prestamos) {
    const cuotas = await db.cuotasPrestamo
      .where('prestamoId')
      .equals(prestamo.id)
      .toArray();
    const saldo = cuotas.reduce(
      (total, cuota) =>
        total +
        Math.max(0, cuota.montoProgramadoCentimos - pagadoDeCuota(aux, cuota.id)),
      0,
    );
    if (saldo > 0) {
      deuda.set(
        prestamo.moneda,
        (deuda.get(prestamo.moneda) ?? 0) + saldo,
      );
    }
  }

  return {
    persona,
    suscripciones,
    prestamos,
    deudaPorMoneda: [...deuda.entries()].map(([moneda, centimos]) => ({
      moneda,
      centimos,
    })),
    pagosRecientes: pagos
      .sort((a, b) => b.fechaPago.localeCompare(a.fechaPago))
      .slice(0, 5),
  };
}
