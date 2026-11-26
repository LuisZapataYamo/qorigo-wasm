import type { DatosQoriGo } from './puertos/persistencia';
import type { CuotaPrestamo, Persona, Prestamo } from '../dominio/modelo';
import { auditar } from './auditoria';
import { aCentimos } from '../dominio/dinero';
import {
  ErrorNoEncontrado,
  ErrorReglaNegocio,
  ErrorValidacion,
} from '../dominio/errores';
import { esFechaValida, finDeMes, periodoActual, sumarMeses } from '../dominio/fechas';
import { diasEntre, hoy } from '../dominio/fechas';
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
import { cargarAuxiliaresSaldos, pagadoDeCuota, aplicacionesDeCuota } from './saldos';

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
  db: DatosQoriGo,
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
  db: DatosQoriGo,
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
  db: DatosQoriGo,
  id: string,
): Promise<Prestamo> {
  const prestamo = await db.prestamos.get(id);
  if (!prestamo) throw new ErrorNoEncontrado('El préstamo no existe.');
  return prestamo;
}

export interface PrestamoListado extends Prestamo {
  persona: string;
}

export async function listarPrestamos(db: DatosQoriGo): Promise<PrestamoListado[]> {
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
  db: DatosQoriGo,
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

/* ------------------------------- CU-10 ------------------------------- */

export interface EntradaAjusteCuota {
  nuevoMonto: number | string;
  motivo: string;
  redistribucion?: 'EQUITATIVA' | 'ULTIMA';
  usuarioId?: string;
}

/**
 * Ajusta una cuota pendiente o parcial de un préstamo flexible. La diferencia
 * se redistribuye entre las cuotas posteriores para que el total no cambie.
 */
export async function ajustarCuota(
  db: DatosQoriGo,
  cuotaId: string,
  entrada: EntradaAjusteCuota,
): Promise<CuotaPrestamo[]> {
  const cuota = await db.cuotasPrestamo.get(cuotaId);
  if (!cuota) throw new ErrorNoEncontrado('La cuota no existe.');
  const prestamo = await db.prestamos.get(cuota.prestamoId);
  if (!prestamo) throw new ErrorNoEncontrado('El préstamo no existe.');
  if (prestamo.estrictoCumplimiento) {
    throw new ErrorReglaNegocio(
      'Los préstamos de estricto cumplimiento no permiten ajustar cuotas.',
    );
  }
  if (prestamo.estado !== 'ACTIVO') {
    throw new ErrorReglaNegocio(
      'Solo se pueden ajustar cuotas de un préstamo activo.',
    );
  }
  if (cuota.estado === 'PAGADA') {
    throw new ErrorReglaNegocio('No se puede ajustar una cuota pagada.');
  }
  const motivo = entrada.motivo?.trim() ?? '';
  if (!motivo) {
    throw new ErrorValidacion('El motivo del ajuste es obligatorio.', 'motivo');
  }

  const nuevoMonto = aCentimos(entrada.nuevoMonto);
  if (nuevoMonto <= 0) {
    throw new ErrorValidacion(
      'El nuevo monto debe ser mayor que cero.',
      'nuevoMonto',
    );
  }

  const aux = await cargarAuxiliaresSaldos(db);
  const pagadoActual = pagadoDeCuota(aux, cuota.id);
  if (nuevoMonto < pagadoActual) {
    throw new ErrorReglaNegocio(
      'El nuevo monto no puede ser menor que lo ya aplicado a la cuota.',
    );
  }

  const posteriores = (await cuotasDePrestamo(db, prestamo.id)).filter(
    (c) => c.numeroCuota > cuota.numeroCuota && c.estado !== 'PAGADA',
  );
  if (posteriores.length === 0) {
    throw new ErrorReglaNegocio(
      'No hay cuotas posteriores pendientes donde redistribuir la diferencia.',
    );
  }

  const diferencia = nuevoMonto - cuota.montoProgramadoCentimos;
  const aRedistribuir = -diferencia;
  const cambios = new Map<string, number>();
  cambios.set(cuota.id, nuevoMonto);

  if (aRedistribuir !== 0) {
    if (entrada.redistribucion === 'ULTIMA') {
      const ultima = posteriores[posteriores.length - 1];
      cambios.set(
        ultima.id,
        ultima.montoProgramadoCentimos + aRedistribuir,
      );
    } else {
      const base = Math.trunc(aRedistribuir / posteriores.length);
      const resto = aRedistribuir - base * posteriores.length;
      posteriores.forEach((posterior, indice) => {
        const extra =
          indice === posteriores.length - 1 ? base + resto : base;
        cambios.set(
          posterior.id,
          posterior.montoProgramadoCentimos + extra,
        );
      });
    }
  }

  const actualizadas: CuotaPrestamo[] = [];
  for (const [id, monto] of cambios) {
    const original =
      id === cuota.id
        ? cuota
        : posteriores.find((c) => c.id === id)!;
    const pagado = pagadoDeCuota(aux, id);
    if (monto <= 0) {
      throw new ErrorReglaNegocio(
        'El ajuste dejaría una cuota en cero.',
      );
    }
    if (monto < pagado) {
      throw new ErrorReglaNegocio(
        'El ajuste dejaría una cuota por debajo de lo ya pagado.',
      );
    }
    const reparto = repartirCapitalInteres(
      monto,
      original.capitalProgramadoCentimos,
      original.interesProgramadoCentimos,
    );
    actualizadas.push({
      ...original,
      capitalProgramadoCentimos: reparto.capital,
      interesProgramadoCentimos: reparto.interes,
      montoProgramadoCentimos: monto,
    });
  }

  const sumaAntes =
    cuota.montoProgramadoCentimos +
    posteriores.reduce((t, c) => t + c.montoProgramadoCentimos, 0);
  const sumaDespues = actualizadas.reduce(
    (t, c) => t + c.montoProgramadoCentimos,
    0,
  );
  if (sumaAntes !== sumaDespues) {
    throw new ErrorReglaNegocio(
      'El ajuste no conserva el total del préstamo.',
    );
  }

  await db.transaction(
    'rw',
    db.cuotasPrestamo,
    db.cuotaAjustes,
    db.auditoria,
    async () => {
      for (const actualizada of actualizadas) {
        await db.cuotasPrestamo.put(actualizada);
        const anterior =
          actualizada.id === cuota.id
            ? cuota
            : posteriores.find((c) => c.id === actualizada.id)!;
        await db.cuotaAjustes.add({
          id: nuevoId(),
          cuotaId: actualizada.id,
          usuarioId: entrada.usuarioId,
          montoAnteriorCentimos: anterior.montoProgramadoCentimos,
          montoNuevoCentimos: actualizada.montoProgramadoCentimos,
          motivo,
          creadoEn: new Date().toISOString(),
        });
      }
      await auditar(db, {
        entidad: 'CUOTA_PRESTAMO',
        entidadId: cuota.id,
        accion: 'AJUSTAR',
        antes: actualizadas.map((a) => ({
          id: a.id,
          monto: a.montoProgramadoCentimos,
        })),
        despues: {
          motivo,
          montoNuevo: nuevoMonto,
          cuotasAfectadas: actualizadas.length,
        },
      });
    },
  );

  return (await cuotasDePrestamo(db, prestamo.id)).filter((c) =>
    actualizadas.some((a) => a.id === c.id),
  );
}

export async function cambiarCumplimiento(
  db: DatosQoriGo,
  prestamoId: string,
  estrictoCumplimiento: boolean,
  usuarioId?: string,
): Promise<Prestamo> {
  const anterior = await obtenerPrestamo(db, prestamoId);
  if (anterior.estado === 'ANULADO') {
    throw new ErrorReglaNegocio(
      'No se puede cambiar el cumplimiento de un préstamo anulado.',
    );
  }
  const actualizado: Prestamo = { ...anterior, estrictoCumplimiento };
  await db.transaction('rw', db.prestamos, db.auditoria, async () => {
    await db.prestamos.put(actualizado);
    await auditar(db, {
      entidad: 'PRESTAMO',
      entidadId: prestamoId,
      accion: 'CAMBIAR_CUMPLIMIENTO',
      usuarioId,
      antes: { estrictoCumplimiento: anterior.estrictoCumplimiento },
      despues: { estrictoCumplimiento },
    });
  });
  return actualizado;
}

/* ------------------------- Exigible del mes ------------------------- */

export interface ExigiblePrestamo {
  prestamoId: string;
  periodo: string;
  saldoAnteriorCentimos: number;
  cuotaMesCentimos: number;
  exigibleCentimos: number;
  atrasadoNoAcumuladoCentimos: number;
}

/**
 * Estricto: lo vencido antes del mes se suma al exigible.
 * Flexible: solo cuenta la cuota del mes; lo atrasado se informa aparte.
 */
export async function exigibleDelMes(
  db: DatosQoriGo,
  prestamoId: string,
  periodo: string = periodoActual(),
): Promise<ExigiblePrestamo> {
  const prestamo = await obtenerPrestamo(db, prestamoId);
  const cuotas = await cuotasDePrestamo(db, prestamo.id);
  const aux = await cargarAuxiliaresSaldos(db);
  const fin = finDeMes(periodo);

  let saldoAnterior = 0;
  let cuotaMes = 0;
  for (const cuota of cuotas) {
    const saldo = Math.max(
      0,
      cuota.montoProgramadoCentimos - pagadoDeCuota(aux, cuota.id),
    );
    if (saldo <= 0) continue;
    if (cuota.fechaVencimiento < periodo) {
      saldoAnterior += saldo;
    } else if (cuota.fechaVencimiento <= fin) {
      cuotaMes += saldo;
    }
  }

  return {
    prestamoId,
    periodo,
    saldoAnteriorCentimos: saldoAnterior,
    cuotaMesCentimos: cuotaMes,
    exigibleCentimos: prestamo.estrictoCumplimiento
      ? saldoAnterior + cuotaMes
      : cuotaMes,
    atrasadoNoAcumuladoCentimos: prestamo.estrictoCumplimiento
      ? 0
      : saldoAnterior,
  };
}

/* ------------------------------- CU-11 ------------------------------- */

export async function marcarIncobrable(
  db: DatosQoriGo,
  prestamoId: string,
  motivo: string,
  usuarioId?: string,
): Promise<Prestamo> {
  const prestamo = await obtenerPrestamo(db, prestamoId);
  const texto = motivo?.trim() ?? '';
  if (!texto) {
    throw new ErrorValidacion('El motivo es obligatorio.', 'motivo');
  }
  if (prestamo.estado !== 'ACTIVO') {
    throw new ErrorReglaNegocio(
      'Solo un préstamo activo puede marcarse como incobrable.',
    );
  }

  const actualizado: Prestamo = {
    ...prestamo,
    estado: 'INCOBRABLE',
    motivoEstado: texto,
    fechaEstado: new Date().toISOString(),
  };

  await db.transaction('rw', db.prestamos, db.auditoria, async () => {
    await db.prestamos.put(actualizado);
    await auditar(db, {
      entidad: 'PRESTAMO',
      entidadId: prestamoId,
      accion: 'MARCAR_INCOBRABLE',
      usuarioId,
      antes: { estado: prestamo.estado },
      despues: { estado: actualizado.estado, motivo: texto },
    });
  });

  return actualizado;
}

export async function anularPrestamo(
  db: DatosQoriGo,
  prestamoId: string,
  motivo?: string,
  usuarioId?: string,
): Promise<Prestamo> {
  const prestamo = await obtenerPrestamo(db, prestamoId);
  if (prestamo.estado === 'ANULADO') {
    throw new ErrorReglaNegocio('El préstamo ya está anulado.');
  }

  const aux = await cargarAuxiliaresSaldos(db);
  const cuotas = await cuotasDePrestamo(db, prestamo.id);
  const tienePagos = cuotas.some((cuota) =>
    aux.aplicaciones.some(
      (a) => a.cuotaId === cuota.id && aux.pagosRegistrados.has(a.pagoId),
    ),
  );
  if (tienePagos) {
    throw new ErrorReglaNegocio(
      'No se puede anular un préstamo con pagos activos.',
    );
  }

  const actualizado: Prestamo = {
    ...prestamo,
    estado: 'ANULADO',
    motivoEstado: motivo?.trim() || undefined,
    fechaEstado: new Date().toISOString(),
  };

  await db.transaction('rw', db.prestamos, db.auditoria, async () => {
    await db.prestamos.put(actualizado);
    await auditar(db, {
      entidad: 'PRESTAMO',
      entidadId: prestamoId,
      accion: 'ANULAR',
      usuarioId,
      antes: { estado: prestamo.estado },
      despues: { estado: actualizado.estado, motivo: actualizado.motivoEstado },
    });
  });

  return actualizado;
}

export interface ResumenPrestamo {
  prestamoId: string;
  capitalCentimos: number;
  totalProgramadoCentimos: number;
  totalCobradoCentimos: number;
  capitalRecuperadoCentimos: number;
  interesCobradoCentimos: number;
  saldoPendienteCentimos: number;
  saldoVencidoCentimos: number;
  diasMaxAtraso: number;
  resultadoCentimos: number;
  perdidaNetaCentimos: number;
  marca: 'EN_RIESGO' | 'EN_PERDIDA' | null;
}

export async function resumenPrestamo(
  db: DatosQoriGo,
  prestamoId: string,
): Promise<ResumenPrestamo> {
  const prestamo = await obtenerPrestamo(db, prestamoId);
  const cuotas = await cuotasDePrestamo(db, prestamo.id);
  const aux = await cargarAuxiliaresSaldos(db);
  const umbral = Number(
    (await db.configuracion.get('umbral_riesgo_dias'))?.valor ?? '30',
  );
  const hoyTexto = hoy();

  let totalProgramado = 0;
  let totalCobrado = 0;
  let saldoPendiente = 0;
  let saldoVencido = 0;
  let diasMaxAtraso = 0;

  for (const cuota of cuotas) {
    totalProgramado += cuota.montoProgramadoCentimos;
    const aplicaciones = aplicacionesDeCuota(aux, cuota.id);
    const pagado = aplicaciones.reduce(
      (t, a) => t + a.montoAplicadoCentimos,
      0,
    );
    const saldo = Math.max(0, cuota.montoProgramadoCentimos - pagado);
    totalCobrado += pagado;
    saldoPendiente += saldo;
    if (saldo > 0 && cuota.fechaVencimiento < hoyTexto) {
      saldoVencido += saldo;
      diasMaxAtraso = Math.max(
        diasMaxAtraso,
        diasEntre(cuota.fechaVencimiento, hoyTexto),
      );
    }
  }

  const idsCuotas = new Set(cuotas.map((c) => c.id));
  const aplicacionesDelPrestamo = aux.aplicaciones.filter(
    (a) => a.cuotaId && idsCuotas.has(a.cuotaId),
  );
  const capitalRecuperado = aplicacionesDelPrestamo.reduce(
    (total, a) => total + (a.montoCapitalCentimos ?? 0),
    0,
  );
  const interesCobrado = aplicacionesDelPrestamo.reduce(
    (total, a) => total + (a.montoInteresCentimos ?? 0),
    0,
  );

  const perdidaNeta =
    prestamo.estado === 'INCOBRABLE'
      ? Math.max(0, prestamo.capitalCentimos - totalCobrado)
      : 0;

  const marca: ResumenPrestamo['marca'] =
    prestamo.estado === 'INCOBRABLE'
      ? 'EN_PERDIDA'
      : prestamo.estado === 'ACTIVO' &&
          saldoVencido > 0 &&
          diasMaxAtraso > umbral
        ? 'EN_RIESGO'
        : null;

  return {
    prestamoId,
    capitalCentimos: prestamo.capitalCentimos,
    totalProgramadoCentimos: totalProgramado,
    totalCobradoCentimos: totalCobrado,
    capitalRecuperadoCentimos: capitalRecuperado,
    interesCobradoCentimos: interesCobrado,
    saldoPendienteCentimos: saldoPendiente,
    saldoVencidoCentimos: saldoVencido,
    diasMaxAtraso,
    resultadoCentimos: totalCobrado - prestamo.capitalCentimos,
    perdidaNetaCentimos: perdidaNeta,
    marca,
  };
}
