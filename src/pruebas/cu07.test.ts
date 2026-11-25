import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import { simularPrestamo } from '../aplicacion/prestamos';
import { ErrorValidacion } from '../dominio/errores';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

describe('CU-07 Simular préstamo', () => {
  it('PA-CU07-01 calcula el cronograma de PM-2 sin guardar nada', () => {
    const simulacion = simularPrestamo({
      capital: '2000.00',
      tasaMensual: 5,
      plazoMeses: 6,
      fechaPrimerPago: '2026-10-01',
    });

    expect(simulacion.interesTotalCentimos).toBe(60000);
    expect(simulacion.totalCentimos).toBe(260000);
    expect(simulacion.cuotas).toHaveLength(6);
    expect(simulacion.cuotas.slice(0, 5).map((c) => c.montoCentimos)).toEqual([
      43333, 43333, 43333, 43333, 43333,
    ]);
    expect(simulacion.cuotas[5]?.montoCentimos).toBe(43335);
    expect(simulacion.cuotas[5]?.capitalCentimos).toBe(33335);
    expect(simulacion.cuotas[5]?.interesCentimos).toBe(10000);
  });

  it('PA-CU07-02 recalcula al cambiar el plazo a cuatro meses', () => {
    const simulacion = simularPrestamo({
      capital: '2000.00',
      tasaMensual: 5,
      plazoMeses: 4,
      fechaPrimerPago: '2026-10-01',
    });

    expect(simulacion.interesTotalCentimos).toBe(40000);
    expect(simulacion.totalCentimos).toBe(240000);
    expect(simulacion.cuotas.map((c) => c.montoCentimos)).toEqual([
      60000, 60000, 60000, 60000,
    ]);
  });

  it('PA-CU07-03 rechaza tasa negativa o plazo cero', () => {
    expect(() =>
      simularPrestamo({
        capital: '2000.00',
        tasaMensual: -1,
        plazoMeses: 6,
        fechaPrimerPago: '2026-10-01',
      }),
    ).toThrow(ErrorValidacion);

    expect(() =>
      simularPrestamo({
        capital: '2000.00',
        tasaMensual: 5,
        plazoMeses: 0,
        fechaPrimerPago: '2026-10-01',
      }),
    ).toThrow(ErrorValidacion);
  });

  it('la suma de cuotas y de capitales coincide con el total', async () => {
    const simulacion = simularPrestamo({
      capital: '1500.00',
      tasaMensual: 10,
      plazoMeses: 2,
      fechaPrimerPago: '2026-12-01',
    });

    const sumaCuotas = simulacion.cuotas.reduce(
      (total, cuota) => total + cuota.montoCentimos,
      0,
    );
    const sumaCapital = simulacion.cuotas.reduce(
      (total, cuota) => total + cuota.capitalCentimos,
      0,
    );
    expect(sumaCuotas).toBe(simulacion.totalCentimos);
    expect(sumaCapital).toBe(simulacion.capitalCentimos);
    expect(await db.prestamos.count()).toBe(0);
    expect(await db.cuotasPrestamo.count()).toBe(0);
  });
});
