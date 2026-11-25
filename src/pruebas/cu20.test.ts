import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import {
  rentabilidad,
  rentabilidadACsv,
} from '../aplicacion/reportes';
import { generarPeriodo } from '../aplicacion/cargos';
import { agregarMiembro } from '../aplicacion/miembros';
import { registrarPersona } from '../aplicacion/personas';
import { registrarPago } from '../aplicacion/pagos';
import {
  crearPrestamo,
  marcarIncobrable,
} from '../aplicacion/prestamos';
import { crearSuscripcion } from '../aplicacion/suscripciones';
import { obtenerObligacionesPendientes } from '../aplicacion/pagos';
import { fijarHoy } from '../dominio/fechas';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function persona(nombres: string, apellidos: string) {
  const alta = await registrarPersona(
    db,
    { nombres, apellidos },
    { resolucionSimilar: 'crear' },
  );
  return alta.persona!;
}

async function escenario() {
  fijarHoy('2026-11-24');
  const a = await persona('Ana', 'Alvarez');
  const b = await persona('Beto', 'Benitez');
  const c = await persona('Carla', 'Castillo');

  const plataforma = await db.plataformas
    .filter((p) => p.nombre === 'Microsoft')
    .first();
  const suscripcion = await crearSuscripcion(db, {
    plataformaId: plataforma!.id,
    nombre: 'Plan 30',
    moneda: 'PEN',
    costo: '30.00',
    capacidad: 5,
    diaCobro: 5,
    fechaInicio: '2026-01-01',
  });
  await agregarMiembro(db, suscripcion.id, {
    personaId: a.id,
    montoAcordado: '30.00',
    fechaInicio: '2026-01-01',
  });
  await generarPeriodo(db, '2026-11-01');

  const cargo = (
    await obtenerObligacionesPendientes(db, a.id, 'SUSCRIPCION')
  )[0]!;
  await registrarPago(db, {
    personaId: a.id,
    moneda: 'PEN',
    fechaPago: '2026-11-10',
    monto: '30.00',
    metodoPago: 'EFECTIVO',
    aplicaciones: [
      { tipo: 'SUSCRIPCION', obligacionId: cargo.id, monto: '30.00' },
    ],
  });

  const l1 = await crearPrestamo(db, {
    personaId: a.id,
    moneda: 'PEN',
    capital: '1000.00',
    tasaMensual: 10,
    plazoMeses: 1,
    fechaPrestamo: '2026-10-01',
    fechaPrimerPago: '2026-11-01',
    estrictoCumplimiento: false,
  });
  const cuota = (
    await obtenerObligacionesPendientes(db, a.id, 'PRESTAMO')
  )[0]!;
  await registrarPago(db, {
    personaId: a.id,
    moneda: 'PEN',
    fechaPago: '2026-11-15',
    monto: '1100.00',
    metodoPago: 'EFECTIVO',
    aplicaciones: [
      { tipo: 'PRESTAMO', obligacionId: cuota.id, monto: '1100.00' },
    ],
  });

  await crearPrestamo(db, {
    personaId: b.id,
    moneda: 'PEN',
    capital: '500.00',
    tasaMensual: 0,
    plazoMeses: 1,
    fechaPrestamo: '2026-11-02',
    fechaPrimerPago: '2026-12-02',
    estrictoCumplimiento: false,
  });

  const l3 = await crearPrestamo(db, {
    personaId: c.id,
    moneda: 'PEN',
    capital: '800.00',
    tasaMensual: 0,
    plazoMeses: 1,
    fechaPrestamo: '2026-09-01',
    fechaPrimerPago: '2026-10-01',
    estrictoCumplimiento: false,
  });
  await marcarIncobrable(db, l3.prestamo.id, 'Cliente ilocalizable');
  await db.prestamos.update(l3.prestamo.id, {
    fechaEstado: '2026-11-20T12:00:00.000Z',
  });

  return { a, b, c, l1 };
}

describe('CU-20 Informe de rentabilidad', () => {
  it('PA-CU20-01 separa margen de suscripciones e interés cobrado', async () => {
    await escenario();
    const informe = await rentabilidad(db, '2026-11-01', 'PEN');

    expect(informe.margenSuscripcionesCentimos).toBe(0);
    expect(informe.interesCobradoCentimos).toBe(10000);
    expect(
      informe.margenSuscripcionesCentimos + informe.interesCobradoCentimos,
    ).toBe(10000);
  });

  it('PA-CU20-02 combina el aporte y los intereses por persona', async () => {
    const { a, b, c } = await escenario();
    const informe = await rentabilidad(db, '2026-11-01', 'PEN');

    const personaA = informe.porPersona.find((p) => p.id === a.id)!;
    expect(personaA.margenSuscripcionesCentimos).toBe(3000);
    expect(personaA.interesCobradoCentimos).toBe(10000);
    expect(personaA.resultadoCentimos).toBe(13000);

    const personaC = informe.porPersona.find((p) => p.id === c.id)!;
    expect(personaC.perdidasCentimos).toBe(80000);
    expect(personaC.resultadoCentimos).toBe(-80000);
    expect(informe.porPersona.some((p) => p.id === b.id)).toBe(false);
  });

  it('PA-CU20-03 resta la pérdida del incobrable del mes', async () => {
    await escenario();
    const informe = await rentabilidad(db, '2026-11-01', 'PEN');

    expect(informe.perdidasIncobrablesCentimos).toBe(80000);
    expect(informe.resultadoCentimos).toBe(-70000);
  });

  it('PA-CU20-04 calcula el porcentaje sobre costos y capital en la calle', async () => {
    await escenario();
    const informe = await rentabilidad(db, '2026-11-01', 'PEN');

    expect(informe.costosCentimos).toBe(3000);
    expect(informe.capitalEnLaCalleCentimos).toBe(50000);
    expect(informe.rentabilidadPorcentaje).toBe(-132.08);
  });

  it('exporta la rentabilidad a CSV', async () => {
    await escenario();
    const csv = rentabilidadACsv(
      await rentabilidad(db, '2026-11-01', 'PEN'),
    );

    expect(csv).toContain('Plan 30');
    expect(csv).toContain('PERSONA');
    expect(csv.split('\r\n').length).toBeGreaterThan(3);
  });
});
