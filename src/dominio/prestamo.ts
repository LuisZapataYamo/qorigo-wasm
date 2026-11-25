import { aCentimos } from './dinero';
import { ErrorValidacion } from './errores';
import { sumarMeses } from './fechas';

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.fechaPrimerPago)) {
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
