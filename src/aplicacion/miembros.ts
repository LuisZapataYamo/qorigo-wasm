import type { BaseDatos } from '../db/baseDatos';
import type { MiembroSuscripcion, Persona } from '../db/tipos';
import { auditar } from '../db/auditoria';
import { aCentimos } from '../dominio/dinero';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorReglaNegocio,
  ErrorValidacion,
} from '../dominio/errores';
import { esFechaValida } from '../dominio/fechas';
import { nuevoId } from '../dominio/ids';
import {
  registrarPersona,
  type EntradaPersona,
  type ResolucionSimilar,
} from './personas';
import { detalleSuscripcion } from './suscripciones';

export interface EntradaMiembro {
  personaId: string;
  montoAcordado: number | string;
  esPlazaPropia?: boolean;
  fechaInicio: string;
}

export interface MiembroAgregado {
  miembro: MiembroSuscripcion;
  persona: Persona;
  coberturaCentimos: number;
}

export async function agregarMiembro(
  db: BaseDatos,
  suscripcionId: string,
  entrada: EntradaMiembro,
): Promise<MiembroAgregado> {
  const persona = await db.personas.get(entrada.personaId);
  if (!persona) {
    throw new ErrorNoEncontrado('La persona no existe.');
  }
  if (!persona.activo) {
    throw new ErrorReglaNegocio(
      'No se puede agregar una persona inactiva como miembro.',
    );
  }
  if (!esFechaValida(entrada.fechaInicio)) {
    throw new ErrorValidacion(
      'La fecha de inicio no es válida.',
      'fechaInicio',
    );
  }

  const esPlazaPropia = entrada.esPlazaPropia ?? false;
  const montoSolicitado = aCentimos(entrada.montoAcordado);
  if (montoSolicitado < 0) {
    throw new ErrorValidacion(
      'El monto acordado no puede ser negativo.',
      'montoAcordado',
    );
  }
  if (esPlazaPropia && montoSolicitado !== 0) {
    throw new ErrorValidacion(
      'La plaza propia no genera cargos: el monto debe ser 0.',
      'montoAcordado',
    );
  }
  const montoCentimos = esPlazaPropia ? 0 : montoSolicitado;

  const miembroId = nuevoId();
  let coberturaCentimos = 0;

  await db.transaction(
    'rw',
    db.suscripciones,
    db.miembrosSuscripcion,
    db.auditoria,
    async () => {
      const suscripcion = await db.suscripciones.get(suscripcionId);
      if (!suscripcion) {
        throw new ErrorNoEncontrado('La suscripción no existe.');
      }
      if (suscripcion.estado !== 'ACTIVA') {
        throw new ErrorReglaNegocio(
          'Solo se pueden agregar miembros a una suscripción activa.',
        );
      }

      const activos = await db.miembrosSuscripcion
        .where('suscripcionId')
        .equals(suscripcionId)
        .and((m) => m.estado === 'ACTIVO')
        .count();

      if (activos >= suscripcion.capacidad) {
        throw new ErrorReglaNegocio(
          'No hay plazas libres en esta suscripción.',
        );
      }

      const duplicado = await db.miembrosSuscripcion
        .where('[suscripcionId+personaId]')
        .equals([suscripcionId, entrada.personaId])
        .and((m) => m.estado === 'ACTIVO')
        .first();
      if (duplicado) {
        throw new ErrorConflicto(
          'La persona ya tiene una membresía activa en esta suscripción.',
        );
      }

      const miembro: MiembroSuscripcion = {
        id: miembroId,
        suscripcionId,
        personaId: entrada.personaId,
        montoAcordadoCentimos: montoCentimos,
        esPlazaPropia,
        fechaInicio: entrada.fechaInicio,
        estado: 'ACTIVO',
      };

      await db.miembrosSuscripcion.add(miembro);
      await auditar(db, {
        entidad: 'MIEMBRO_SUSCRIPCION',
        entidadId: miembro.id,
        accion: 'CREAR',
        despues: miembro,
      });

      const activosDespues =
        await db.miembrosSuscripcion
          .where('suscripcionId')
          .equals(suscripcionId)
          .and((m) => m.estado === 'ACTIVO')
          .toArray();
      coberturaCentimos =
        activosDespues.reduce((total, m) => total + m.montoAcordadoCentimos, 0) -
        suscripcion.costoCentimos;
    },
  );

  return {
    miembro: (await db.miembrosSuscripcion.get(miembroId))!,
    persona,
    coberturaCentimos,
  };
}

export interface ResultadoPersonaNuevaMiembro {
  estado: 'AGREGADO' | 'PERSONA_REQUIERE_DECISION';
  agregado?: MiembroAgregado;
  similares: Persona[];
}

/** RF-SUS-04 / CU-01: permite crear la persona desde el alta del miembro. */
export async function agregarMiembroConPersonaNueva(
  db: BaseDatos,
  suscripcionId: string,
  datosPersona: EntradaPersona,
  datosMiembro: Omit<EntradaMiembro, 'personaId'>,
  resolucionSimilar?: ResolucionSimilar,
): Promise<ResultadoPersonaNuevaMiembro> {
  const registro = await registrarPersona(db, datosPersona, {
    resolucionSimilar,
  });

  if (registro.estado === 'REQUIERE_DECISION') {
    return {
      estado: 'PERSONA_REQUIERE_DECISION',
      similares: registro.similares,
    };
  }

  const agregado = await agregarMiembro(db, suscripcionId, {
    ...datosMiembro,
    personaId: registro.persona!.id,
  });

  return { estado: 'AGREGADO', agregado, similares: [] };
}

export interface MiembroConPersona {
  miembro: MiembroSuscripcion;
  persona: Persona;
}

export async function listarMiembros(
  db: BaseDatos,
  suscripcionId: string,
): Promise<MiembroConPersona[]> {
  const miembros = await db.miembrosSuscripcion
    .where('suscripcionId')
    .equals(suscripcionId)
    .toArray();
  const resultado: MiembroConPersona[] = [];
  for (const miembro of miembros) {
    const persona = await db.personas.get(miembro.personaId);
    if (persona) resultado.push({ miembro, persona });
  }
  return resultado.sort((a, b) =>
    `${a.persona.apellidos} ${a.persona.nombres}`.localeCompare(
      `${b.persona.apellidos} ${b.persona.nombres}`,
      'es',
    ),
  );
}

/** Detalle actualizado tras el alta, útil para mostrar la cobertura. */
export async function coberturaActual(
  db: BaseDatos,
  suscripcionId: string,
): Promise<number> {
  const detalle = await detalleSuscripcion(db, suscripcionId);
  return detalle.coberturaCentimos;
}
