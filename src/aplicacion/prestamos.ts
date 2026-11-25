import type { BaseDatos } from '../db/baseDatos';
import type { CuotaPrestamo, Persona, Prestamo } from '../db/tipos';
import { auditar } from '../db/auditoria';
import {
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../dominio/errores';
import { esFechaValida, sumarMeses } from '../dominio/fechas';
import { nuevoId } from '../dominio/ids';
import {
  calcularCronograma,
  type CronogramaCalculado,
  type EntradaCalculo,
} from '../dominio/prestamo';
import {
  registrarPersona,
  type EntradaPersona,
  type ResolucionSimilar,
} from './personas';

export type SimulacionPrestamo = CronogramaCalculado & {
  tasaMensual: number;
  plazoMeses: number;
  fechaPrimerPago: string;
};

/** CU-07. Calcula el cronograma sin guardar nada. */
export function simularPrestamo(entrada: EntradaCalculo): SimulacionPrestamo {
  const cronograma = calcularCronograma(entrada);
  return {
    ...cronograma,
    tasaMensual: entrada.tasaMensual,
    plazoMeses: entrada.plazoMeses,
    fechaPrimerPago: entrada.fechaPrimerPago,
  };
}

export interface EntradaPrestamo {
  personaId: string;
  moneda: string;
  capital: number | string;
  tasaMensual: number;
  plazoMeses: number;
  fechaPrestamo: string;
  fechaPrimerPago?: string;
  estrictoCumplimiento: boolean;
  notas?: string;
}

export interface PrestamoCreado {
  prestamo: Prestamo;
  cuotas: CuotaPrestamo[];
}

export interface OpcionesCreacionPrestamo {
  /** Hook de integración para simular fallos al insertar una cuota. */
  alInsertarCuota?: (numero: number) => void | Promise<void>;
}

export async function crearPrestamo(
  db: BaseDatos,
  entrada: EntradaPrestamo,
  opciones: OpcionesCreacionPrestamo = {},
): Promise<PrestamoCreado> {
  const persona = await db.personas.get(entrada.personaId);
  if (!persona) {
    throw new ErrorNoEncontrado('La persona no existe.');
  }
  if (!(await db.monedas.get(entrada.moneda))) {
    throw new ErrorValidacion('La moneda no existe.', 'moneda');
  }
  if (!esFechaValida(entrada.fechaPrestamo)) {
    throw new ErrorValidacion(
      'La fecha del préstamo no es válida.',
      'fechaPrestamo',
    );
  }
  if (typeof entrada.estrictoCumplimiento !== 'boolean') {
    throw new ErrorValidacion(
      'Debes indicar si el préstamo es de estricto cumplimiento.',
      'estrictoCumplimiento',
    );
  }

  const primerPago = entrada.fechaPrimerPago
    ? entrada.fechaPrimerPago
    : sumarMeses(entrada.fechaPrestamo, 1);
  if (!esFechaValida(primerPago)) {
    throw new ErrorValidacion(
      'La fecha del primer pago no es válida.',
      'fechaPrimerPago',
    );
  }

  const cronograma = calcularCronograma({
    capital: entrada.capital,
    tasaMensual: entrada.tasaMensual,
    plazoMeses: entrada.plazoMeses,
    fechaPrimerPago: primerPago,
  });

  const prestamo: Prestamo = {
    id: nuevoId(),
    personaId: entrada.personaId,
    moneda: entrada.moneda,
    capitalCentimos: cronograma.capitalCentimos,
    tasaMensual: entrada.tasaMensual,
    plazoMeses: entrada.plazoMeses,
    fechaPrestamo: entrada.fechaPrestamo,
    fechaPrimerPago: primerPago,
    estrictoCumplimiento: entrada.estrictoCumplimiento,
    estado: 'ACTIVO',
    notas: entrada.notas?.trim() || undefined,
    creadoEn: new Date().toISOString(),
  };

  const cuotas: CuotaPrestamo[] = cronograma.cuotas.map((cuota) => ({
    id: nuevoId(),
    prestamoId: prestamo.id,
    numeroCuota: cuota.numero,
    fechaVencimiento: cuota.fechaVencimiento,
    capitalProgramadoCentimos: cuota.capitalCentimos,
    interesProgramadoCentimos: cuota.interesCentimos,
    montoProgramadoCentimos: cuota.montoCentimos,
    montoOriginalCentimos: cuota.montoCentimos,
    estado: 'PENDIENTE',
  }));

  await db.transaction(
    'rw',
    db.prestamos,
    db.cuotasPrestamo,
    db.auditoria,
    async () => {
      await db.prestamos.add(prestamo);
      for (const cuota of cuotas) {
        await opciones.alInsertarCuota?.(cuota.numeroCuota);
        await db.cuotasPrestamo.add(cuota);
      }
      await auditar(db, {
        entidad: 'PRESTAMO',
        entidadId: prestamo.id,
        accion: 'CREAR',
        despues: {
          prestamo,
          cuotas: cuotas.length,
          totalCentimos: cronograma.totalCentimos,
        },
      });
    },
  );

  return { prestamo, cuotas };
}

export interface ResultadoPrestamoPersonaNueva {
  estado: 'CREADO' | 'PERSONA_REQUIERE_DECISION';
  creado?: PrestamoCreado;
  similares: Persona[];
}

/** RF-PRE-01 / CU-01: crear la persona desde el alta del préstamo. */
export async function crearPrestamoConPersonaNueva(
  db: BaseDatos,
  datosPersona: EntradaPersona,
  datosPrestamo: Omit<EntradaPrestamo, 'personaId'>,
  resolucionSimilar?: ResolucionSimilar,
): Promise<ResultadoPrestamoPersonaNueva> {
  const registro = await registrarPersona(db, datosPersona, {
    resolucionSimilar,
  });
  if (registro.estado === 'REQUIERE_DECISION') {
    return {
      estado: 'PERSONA_REQUIERE_DECISION',
      similares: registro.similares,
    };
  }
  const creado = await crearPrestamo(db, {
    ...datosPrestamo,
    personaId: registro.persona!.id,
  });
  return { estado: 'CREADO', creado, similares: [] };
}

export async function obtenerPrestamo(
  db: BaseDatos,
  id: string,
): Promise<Prestamo> {
  const prestamo = await db.prestamos.get(id);
  if (!prestamo) throw new ErrorNoEncontrado('El préstamo no existe.');
  return prestamo;
}

export interface PrestamoListado extends Prestamo {
  persona: string;
}

export async function listarPrestamos(db: BaseDatos): Promise<PrestamoListado[]> {
  const [prestamos, personas] = await Promise.all([
    db.prestamos.toArray(),
    db.personas.toArray(),
  ]);
  const mapa = new Map(personas.map((p) => [p.id, p]));
  return prestamos
    .map((prestamo) => {
      const persona = mapa.get(prestamo.personaId);
      return {
        ...prestamo,
        persona: persona
          ? `${persona.apellidos}, ${persona.nombres}`
          : '—',
      };
    })
    .sort((a, b) => b.fechaPrestamo.localeCompare(a.fechaPrestamo));
}

export async function cuotasDePrestamo(
  db: BaseDatos,
  prestamoId: string,
): Promise<CuotaPrestamo[]> {
  const cuotas = await db.cuotasPrestamo
    .where('prestamoId')
    .equals(prestamoId)
    .toArray();
  return cuotas.sort((a, b) => a.numeroCuota - b.numeroCuota);
}

/** Capital e interés se reparten en la proporción global C / T. */
export function repartirCapitalInteres(
  montoAplicado: number,
  capitalCuota: number,
  interesCuota: number,
): { capital: number; interes: number } {
  const total = capitalCuota + interesCuota;
  if (total <= 0) return { capital: 0, interes: 0 };
  const capital = Math.round((montoAplicado * capitalCuota) / total);
  return { capital, interes: montoAplicado - capital };
}
