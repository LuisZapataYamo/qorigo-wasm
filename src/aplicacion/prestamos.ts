import {
  calcularCronograma,
  type CronogramaCalculado,
  type EntradaCalculo,
} from '../dominio/prestamo';

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
