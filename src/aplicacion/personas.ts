import type { BaseDatos } from '../db/baseDatos';
import type { Persona } from '../db/tipos';
import { auditar } from '../db/auditoria';
import { ErrorConflicto, ErrorValidacion } from '../dominio/errores';
import { nuevoId } from '../dominio/ids';
import { normalizar } from '../dominio/normalizar';
import { nombreCompleto, nombreNormalizado } from '../dominio/nombres';

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
