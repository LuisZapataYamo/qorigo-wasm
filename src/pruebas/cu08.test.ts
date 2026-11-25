import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import {
  crearPrestamo,
  crearPrestamoConPersonaNueva,
  cuotasDePrestamo,
} from '../aplicacion/prestamos';
import { registrarPersona } from '../aplicacion/personas';
import { ErrorValidacion } from '../dominio/errores';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function persona(nombres = 'Ernesto', apellidos = 'Quispe Huaman') {
  const alta = await registrarPersona(
    db,
    { nombres, apellidos },
    { resolucionSimilar: 'crear' },
  );
  return alta.persona!;
}

describe('CU-08 Crear préstamo', () => {
  it('PA-CU08-01 crea PM-1 con dos cuotas de 900 y primer pago por defecto', async () => {
    const titular = await persona();
    const { prestamo, cuotas } = await crearPrestamo(db, {
      personaId: titular.id,
      moneda: 'PEN',
      capital: '1500.00',
      tasaMensual: 10,
      plazoMeses: 2,
      fechaPrestamo: '2026-11-01',
      estrictoCumplimiento: true,
    });

    expect(prestamo.fechaPrimerPago).toBe('2026-12-01');
    expect(prestamo.estado).toBe('ACTIVO');
    expect(cuotas.map((c) => c.montoProgramadoCentimos)).toEqual([90000, 90000]);
    expect(cuotas.map((c) => c.fechaVencimiento)).toEqual([
      '2026-12-01',
      '2027-01-01',
    ]);
    expect(
      cuotas.reduce((t, c) => t + c.montoProgramadoCentimos, 0),
    ).toBe(180000);
  });

  it('PA-CU08-02 crea PM-2 con vencimientos de octubre a marzo', async () => {
    const titular = await persona();
    const { cuotas } = await crearPrestamo(db, {
      personaId: titular.id,
      moneda: 'PEN',
      capital: '2000.00',
      tasaMensual: 5,
      plazoMeses: 6,
      fechaPrestamo: '2026-09-01',
      estrictoCumplimiento: false,
    });

    expect(cuotas.map((c) => c.montoProgramadoCentimos)).toEqual([
      43333, 43333, 43333, 43333, 43333, 43335,
    ]);
    expect(cuotas.map((c) => c.fechaVencimiento)).toEqual([
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
      '2027-03-01',
    ]);
  });

  it('PA-CU08-03 la suma de cuotas es exactamente el total', async () => {
    const titular = await persona();
    const { prestamo, cuotas } = await crearPrestamo(db, {
      personaId: titular.id,
      moneda: 'PEN',
      capital: '1733.37',
      tasaMensual: 7.5,
      plazoMeses: 7,
      fechaPrestamo: '2026-10-15',
      estrictoCumplimiento: false,
    });
    const interes = Math.round(
      prestamo.capitalCentimos * (prestamo.tasaMensual / 100) * 7,
    );
    expect(
      cuotas.reduce((t, c) => t + c.montoProgramadoCentimos, 0),
    ).toBe(prestamo.capitalCentimos + interes);
    expect(
      cuotas.reduce((t, c) => t + c.capitalProgramadoCentimos, 0),
    ).toBe(prestamo.capitalCentimos);
  });

  it('PA-CU08-04 ajusta el vencimiento al último día del mes', async () => {
    const titular = await persona();
    const { cuotas } = await crearPrestamo(db, {
      personaId: titular.id,
      moneda: 'PEN',
      capital: '900.00',
      tasaMensual: 0,
      plazoMeses: 3,
      fechaPrestamo: '2026-12-31',
      fechaPrimerPago: '2027-01-31',
      estrictoCumplimiento: true,
    });

    expect(cuotas.map((c) => c.fechaVencimiento)).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
    ]);
  });

  it('PA-CU08-05 exige la bandera de estricto cumplimiento', async () => {
    const titular = await persona();
    await expect(
      crearPrestamo(db, {
        personaId: titular.id,
        moneda: 'PEN',
        capital: '1000.00',
        tasaMensual: 5,
        plazoMeses: 2,
        fechaPrestamo: '2026-11-01',
        estrictoCumplimiento: undefined as unknown as boolean,
      }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect(await db.prestamos.count()).toBe(0);
  });

  it('PA-CU08-06 crea la persona desde el alta del préstamo', async () => {
    const resultado = await crearPrestamoConPersonaNueva(
      db,
      { nombres: 'Kassandra', apellidos: 'Cisneros Zapata' },
      {
        moneda: 'PEN',
        capital: '1000.00',
        tasaMensual: 5,
        plazoMeses: 2,
        fechaPrestamo: '2026-11-01',
        estrictoCumplimiento: false,
      },
    );

    expect(resultado.estado).toBe('CREADO');
    expect(resultado.creado?.cuotas).toHaveLength(2);
    expect(await db.personas.count()).toBe(1);
    expect(await db.prestamos.count()).toBe(1);
  });

  it('PA-CU08-07 revierte todo si falla la inserción de una cuota', async () => {
    const titular = await persona();
    await expect(
      crearPrestamo(
        db,
        {
          personaId: titular.id,
          moneda: 'PEN',
          capital: '2000.00',
          tasaMensual: 5,
          plazoMeses: 6,
          fechaPrestamo: '2026-09-01',
          estrictoCumplimiento: true,
        },
        {
          alInsertarCuota: (numero) => {
            if (numero === 3) throw new Error('Fallo simulado en la cuota 3');
          },
        },
      ),
    ).rejects.toThrow(/Fallo simulado/);

    expect(await db.prestamos.count()).toBe(0);
    expect(await db.cuotasPrestamo.count()).toBe(0);
  });

  it('PA-CU08-08 conserva la moneda del préstamo en sus cuotas', async () => {
    const titular = await persona();
    const { prestamo } = await crearPrestamo(db, {
      personaId: titular.id,
      moneda: 'USD',
      capital: '500.00',
      tasaMensual: 4,
      plazoMeses: 2,
      fechaPrestamo: '2026-11-01',
      estrictoCumplimiento: false,
    });

    expect(prestamo.moneda).toBe('USD');
    const cuotas = await cuotasDePrestamo(db, prestamo.id);
    expect(cuotas).toHaveLength(2);
    expect(cuotas.every((c) => c.estado === 'PENDIENTE')).toBe(true);
  });
});
