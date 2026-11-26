import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../infraestructura/persistencia/baseDatos';
import { crearPrestamo, cuotasDePrestamo } from '../aplicacion/prestamos';
import { registrarPersona } from '../aplicacion/personas';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

describe('CU-09 Generar cuotas (incluido en CU-08)', () => {
  it('PA-CU09-01 desglosa capital e interés de la primera cuota de PM-2', async () => {
    const alta = await registrarPersona(db, {
      nombres: 'Ernesto',
      apellidos: 'Quispe Huaman',
    });
    const { prestamo } = await crearPrestamo(db, {
      personaId: alta.persona!.id,
      moneda: 'PEN',
      capital: '2000.00',
      tasaMensual: 5,
      plazoMeses: 6,
      fechaPrestamo: '2026-09-01',
      estrictoCumplimiento: false,
    });

    const cuotas = await cuotasDePrestamo(db, prestamo.id);
    expect(cuotas[0]?.capitalProgramadoCentimos).toBe(33333);
    expect(cuotas[0]?.interesProgramadoCentimos).toBe(10000);
    expect(cuotas[0]?.montoProgramadoCentimos).toBe(43333);
  });

  it('PA-CU09-02 la última cuota absorbe el redondeo', async () => {
    const alta = await registrarPersona(db, {
      nombres: 'Ernesto',
      apellidos: 'Quispe Huaman',
    });
    const { prestamo } = await crearPrestamo(db, {
      personaId: alta.persona!.id,
      moneda: 'PEN',
      capital: '2000.00',
      tasaMensual: 5,
      plazoMeses: 6,
      fechaPrestamo: '2026-09-01',
      estrictoCumplimiento: false,
    });

    const cuotas = await cuotasDePrestamo(db, prestamo.id);
    expect(cuotas[5]?.capitalProgramadoCentimos).toBe(33335);
    expect(cuotas[5]?.interesProgramadoCentimos).toBe(10000);
    expect(cuotas[5]?.montoProgramadoCentimos).toBe(43335);
    expect(cuotas[5]?.montoOriginalCentimos).toBe(43335);
  });
});
