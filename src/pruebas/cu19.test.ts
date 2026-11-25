import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import { informePrestamos, prestamosACsv } from '../aplicacion/reportes';
import { registrarPersona } from '../aplicacion/personas';
import {
  crearPrestamo,
  marcarIncobrable,
} from '../aplicacion/prestamos';
import { registrarPago } from '../aplicacion/pagos';
import { fijarHoy } from '../dominio/fechas';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function titular() {
  const alta = await registrarPersona(
    db,
    { nombres: 'Ernesto', apellidos: 'Quispe Huaman' },
    { resolucionSimilar: 'crear' },
  );
  return alta.persona!;
}

async function pm2() {
  const persona = await titular();
  return crearPrestamo(db, {
    personaId: persona.id,
    moneda: 'PEN',
    capital: '2000.00',
    tasaMensual: 5,
    plazoMeses: 6,
    fechaPrestamo: '2026-09-01',
    estrictoCumplimiento: false,
  });
}

async function prestamoSimple(fechaPrimerPago: string) {
  const persona = await titular();
  return crearPrestamo(db, {
    personaId: persona.id,
    moneda: 'PEN',
    capital: '1000.00',
    tasaMensual: 0,
    plazoMeses: 1,
    fechaPrestamo: '2026-09-01',
    fechaPrimerPago,
    estrictoCumplimiento: true,
  });
}

describe('CU-19 Informe de préstamos y riesgo', () => {
  it('PA-CU19-01 un préstamo al día no tiene marca', async () => {
    fijarHoy('2026-11-24');
    const { prestamo } = await pm2();
    await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-10-03',
      monto: '434.00',
      metodoPago: 'EFECTIVO',
    });
    await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-11-07',
      monto: '434.00',
      metodoPago: 'EFECTIVO',
    });

    const lineas = await informePrestamos(db, 'PEN');
    expect(lineas[0]?.marca).toBeNull();
  });

  it('PA-CU19-02 marca EN RIESGO con 45 días de atraso', async () => {
    fijarHoy('2026-11-24');
    const { prestamo } = await prestamoSimple('2026-10-10');
    const lineas = await informePrestamos(db, 'PEN');
    const linea = lineas.find((l) => l.prestamoId === prestamo.id)!;

    expect(linea.diasMaxAtraso).toBe(45);
    expect(linea.marca).toBe('EN_RIESGO');
  });

  it('PA-CU19-03 no marca si el atraso está bajo el umbral', async () => {
    fijarHoy('2026-11-24');
    const { prestamo } = await prestamoSimple('2026-11-04');
    const lineas = await informePrestamos(db, 'PEN');
    const linea = lineas.find((l) => l.prestamoId === prestamo.id)!;

    expect(linea.diasMaxAtraso).toBe(20);
    expect(linea.marca).toBeNull();
  });

  it('PA-CU19-04 el umbral configurable cambia la marca', async () => {
    fijarHoy('2026-11-24');
    const { prestamo } = await prestamoSimple('2026-11-04');
    await db.configuracion.put({ clave: 'umbral_riesgo_dias', valor: '15' });

    const lineas = await informePrestamos(db, 'PEN');
    const linea = lineas.find((l) => l.prestamoId === prestamo.id)!;
    expect(linea.marca).toBe('EN_RIESGO');
  });

  it('PA-CU19-05 un incobrable queda EN PÉRDIDA con pérdida neta', async () => {
    fijarHoy('2026-11-24');
    const { prestamo } = await pm2();
    await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-10-03',
      monto: '434.00',
      metodoPago: 'EFECTIVO',
    });
    await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-11-07',
      monto: '434.00',
      metodoPago: 'EFECTIVO',
    });
    await marcarIncobrable(db, prestamo.id, 'Cliente ilocalizable');

    const lineas = await informePrestamos(db, 'PEN');
    const linea = lineas.find((l) => l.prestamoId === prestamo.id)!;
    expect(linea.marca).toBe('EN_PERDIDA');
    expect(linea.perdidaNetaCentimos).toBe(113200);
  });

  it('PA-CU19-06 un préstamo activo con capital no recuperado no es pérdida', async () => {
    fijarHoy('2026-11-24');
    const { prestamo } = await pm2();
    await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-10-03',
      monto: '434.00',
      metodoPago: 'EFECTIVO',
    });
    await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-11-07',
      monto: '434.00',
      metodoPago: 'EFECTIVO',
    });

    const lineas = await informePrestamos(db, 'PEN');
    const linea = lineas.find((l) => l.prestamoId === prestamo.id)!;
    expect(linea.totalCobradoCentimos).toBe(86800);
    expect(linea.resultadoCentimos).toBe(-113200);
    expect(linea.perdidaNetaCentimos).toBe(0);
    expect(linea.marca).toBeNull();
  });

  it('PA-CU19-07 capital recuperado e interés suman el total cobrado', async () => {
    fijarHoy('2026-11-24');
    const { prestamo } = await pm2();
    await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-10-03',
      monto: '434.00',
      metodoPago: 'EFECTIVO',
    });

    const lineas = await informePrestamos(db, 'PEN');
    const linea = lineas.find((l) => l.prestamoId === prestamo.id)!;
    expect(
      linea.capitalRecuperadoCentimos + linea.interesCobradoCentimos,
    ).toBe(linea.totalCobradoCentimos);
  });

  it('exporta el informe de préstamos a CSV', async () => {
    fijarHoy('2026-11-24');
    await prestamoSimple('2026-10-10');
    const csv = prestamosACsv(await informePrestamos(db, 'PEN'));

    expect(csv.split('\r\n')).toHaveLength(2);
    expect(csv).toContain('EN_RIESGO');
    expect(csv).toContain('45');
  });
});
