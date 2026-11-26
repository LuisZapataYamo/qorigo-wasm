import { aCentimos } from './dinero';
import { ErrorValidacion } from './errores';
import { diasEntre, esFechaValida, finDeMes, sumarMeses } from './fechas';
import type {
  AplicacionPago,
  CuotaPrestamo,
  Prestamo,
} from './modelo';

export interface CuotaCalculada {
  numero: number;
  fechaVencimiento: string;
  capitalCentimos: number;
  interesCentimos: number;
  montoCentimos: number;
}

export interface CronogramaCalculado {
  capitalCentimos: number;
  interesTotalCentimos: number;
  totalCentimos: number;
  cuotas: CuotaCalculada[];
}

export interface EntradaCalculo {
  capital: number | string;
  tasaMensual: number;
  plazoMeses: number;
  fechaPrimerPago: string;
}

/**
 * Interés simple mensual sobre el capital original:
 *   I = C × (r / 100) × n,  T = C + I
 * El capital y el interés base de cada cuota se truncan a céntimos y la
 * última cuota absorbe la diferencia (RN-P02).
 */
export function calcularCronograma(
  entrada: EntradaCalculo,
): CronogramaCalculado {
  const capitalCentimos = aCentimos(entrada.capital);
  if (capitalCentimos <= 0) {
    throw new ErrorValidacion('El capital debe ser mayor que cero.', 'capital');
  }
  if (!Number.isFinite(entrada.tasaMensual) || entrada.tasaMensual < 0) {
    throw new ErrorValidacion(
      'La tasa mensual no puede ser negativa.',
      'tasaMensual',
    );
  }
  if (
    !Number.isInteger(entrada.plazoMeses) ||
    entrada.plazoMeses < 1 ||
    entrada.plazoMeses > 120
  ) {
    throw new ErrorValidacion(
      'El plazo debe ser un número entero entre 1 y 120 meses.',
      'plazoMeses',
    );
  }
  if (!esFechaValida(entrada.fechaPrimerPago)) {
    throw new ErrorValidacion(
      'La fecha del primer pago no es válida.',
      'fechaPrimerPago',
    );
  }

  const interesTotalCentimos = Math.round(
    capitalCentimos * (entrada.tasaMensual / 100) * entrada.plazoMeses,
  );
  const baseCapital = Math.floor(capitalCentimos / entrada.plazoMeses);
  const baseInteres = Math.floor(interesTotalCentimos / entrada.plazoMeses);

  const cuotas: CuotaCalculada[] = Array.from(
    { length: entrada.plazoMeses },
    (_, indice) => {
      const ultima = indice === entrada.plazoMeses - 1;
      const capital = ultima
        ? capitalCentimos - baseCapital * (entrada.plazoMeses - 1)
        : baseCapital;
      const interes = ultima
        ? interesTotalCentimos - baseInteres * (entrada.plazoMeses - 1)
        : baseInteres;
      return {
        numero: indice + 1,
        fechaVencimiento: sumarMeses(entrada.fechaPrimerPago, indice),
        capitalCentimos: capital,
        interesCentimos: interes,
        montoCentimos: capital + interes,
      };
    },
  );

  const suma = cuotas.reduce((total, cuota) => total + cuota.montoCentimos, 0);
  const totalCentimos = capitalCentimos + interesTotalCentimos;
  if (suma !== totalCentimos) {
    throw new ErrorValidacion(
      'El cronograma no suma el total del préstamo.',
      'plazoMeses',
    );
  }

  return {
    capitalCentimos,
    interesTotalCentimos,
    totalCentimos,
    cuotas,
  };
}

/** Reparte un monto de cuota entre capital e interés en su proporción. */
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

export interface ExigibleCalculado {
  saldoAnteriorCentimos: number;
  cuotaMesCentimos: number;
  exigibleCentimos: number;
  atrasadoNoAcumuladoCentimos: number;
}

/**
 * Cálculo puro de lo exigible: en estricto se suma el arrastre al mes; en
 * flexible solo cuenta la cuota del mes y lo atrasado se informa aparte.
 */
export function calcularExigible(
  prestamo: Prestamo,
  cuotas: CuotaPrestamo[],
  pagadoPorCuota: (cuotaId: string) => number,
  periodo: string,
): ExigibleCalculado {
  const fin = finDeMes(periodo);
  let saldoAnterior = 0;
  let cuotaMes = 0;

  for (const cuota of cuotas) {
    const saldo = Math.max(
      0,
      cuota.montoProgramadoCentimos - pagadoPorCuota(cuota.id),
    );
    if (saldo <= 0) continue;
    if (cuota.fechaVencimiento < periodo) {
      saldoAnterior += saldo;
    } else if (cuota.fechaVencimiento <= fin) {
      cuotaMes += saldo;
    }
  }

  return {
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

/** Cálculo puro del resumen de un préstamo y sus marcas de riesgo. */
export function calcularResumenPrestamo(
  prestamo: Prestamo,
  cuotas: CuotaPrestamo[],
  aplicacionesDeCuota: (cuotaId: string) => AplicacionPago[],
  hoy: string,
  umbralRiesgo: number,
): ResumenPrestamo {
  let totalProgramado = 0;
  let totalCobrado = 0;
  let saldoPendiente = 0;
  let saldoVencido = 0;
  let diasMaxAtraso = 0;
  let capitalRecuperado = 0;
  let interesCobrado = 0;

  for (const cuota of cuotas) {
    totalProgramado += cuota.montoProgramadoCentimos;
    const aplicaciones = aplicacionesDeCuota(cuota.id);
    const pagado = aplicaciones.reduce(
      (total, a) => total + a.montoAplicadoCentimos,
      0,
    );
    const saldo = Math.max(0, cuota.montoProgramadoCentimos - pagado);
    totalCobrado += pagado;
    saldoPendiente += saldo;
    capitalRecuperado += aplicaciones.reduce(
      (total, a) => total + (a.montoCapitalCentimos ?? 0),
      0,
    );
    interesCobrado += aplicaciones.reduce(
      (total, a) => total + (a.montoInteresCentimos ?? 0),
      0,
    );
    if (saldo > 0 && cuota.fechaVencimiento < hoy) {
      saldoVencido += saldo;
      diasMaxAtraso = Math.max(
        diasMaxAtraso,
        diasEntre(cuota.fechaVencimiento, hoy),
      );
    }
  }

  const perdidaNeta =
    prestamo.estado === 'INCOBRABLE'
      ? Math.max(0, prestamo.capitalCentimos - totalCobrado)
      : 0;

  const marca: ResumenPrestamo['marca'] =
    prestamo.estado === 'INCOBRABLE'
      ? 'EN_PERDIDA'
      : prestamo.estado === 'ACTIVO' &&
          saldoVencido > 0 &&
          diasMaxAtraso > umbralRiesgo
        ? 'EN_RIESGO'
        : null;

  return {
    prestamoId: prestamo.id,
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
