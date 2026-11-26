import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../infraestructura/persistencia/baseDatos';
import {
  informePerdidasSuscripciones,
  informeSuscripciones,
  suscripcionesACsv,
} from '../aplicacion/reportes';
import { generarPeriodo } from '../aplicacion/cargos';
import { agregarMiembro } from '../aplicacion/miembros';
import { registrarPersona } from '../aplicacion/personas';
import { registrarPago } from '../aplicacion/pagos';
import { crearSuscripcion } from '../aplicacion/suscripciones';
import { obtenerObligacionesPendientes } from '../aplicacion/pagos';
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

async function suscripcion(
  plataforma: string,
  nombre: string,
  costo: string,
  capacidad: number,
  esUsoPersonal = false,
) {
  const p = await db.plataformas
    .filter((x) => x.nombre === plataforma)
    .first();
  return crearSuscripcion(db, {
    plataformaId: p!.id,
    nombre,
    moneda: 'PEN',
    costo,
    capacidad,
    diaCobro: 5,
    fechaInicio: '2026-01-01',
    esUsoPersonal,
  });
}

async function miembro(
  suscripcionId: string,
  personaId: string,
  monto: string,
) {
  return agregarMiembro(db, suscripcionId, {
    personaId,
    montoAcordado: monto,
    fechaInicio: '2026-01-01',
  });
}

async function pagarCargo(
  personaId: string,
  cargoId: string,
  monto: string,
) {
  await registrarPago(db, {
    personaId,
    moneda: 'PEN',
    fechaPago: '2026-11-15',
    monto,
    metodoPago: 'EFECTIVO',
    aplicaciones: [
      { tipo: 'SUSCRIPCION', obligacionId: cargoId, monto },
    ],
  });
}

async function cargoDe(personaId: string) {
  const obligaciones = await obtenerObligacionesPendientes(
    db,
    personaId,
    'SUSCRIPCION',
  );
  return obligaciones[0]!;
}

describe('CU-18 Informe de suscripciones y pérdida', () => {
  it('PA-CU18-01 calcula márgenes y causa AMBAS para YouTube', async () => {
    const nayeli = await persona('Nayeli', 'Zapata Yamo');
    const ernesto = await persona('Ernesto', 'Quispe Huaman');
    const angelica = await persona('Angelica', 'Zapata Yamo');
    const youtube = await suscripcion('YouTube', 'YouTube Premium', '53.90', 6);
    await miembro(youtube.id, nayeli.id, '15.00');
    await miembro(youtube.id, ernesto.id, '15.00');
    await miembro(youtube.id, angelica.id, '14.00');
    await generarPeriodo(db, '2026-11-01');

    await pagarCargo(nayeli.id, (await cargoDe(nayeli.id)).id, '15.00');
    await pagarCargo(ernesto.id, (await cargoDe(ernesto.id)).id, '14.00');
    await pagarCargo(angelica.id, (await cargoDe(angelica.id)).id, '14.00');

    const lineas = await informeSuscripciones(db, '2026-11-01', 'PEN');
    const linea = lineas.find((l) => l.suscripcionId === youtube.id)!;

    expect(linea.costoCentimos).toBe(5390);
    expect(linea.esperadoCentimos).toBe(4400);
    expect(linea.cobradoCentimos).toBe(4300);
    expect(linea.margenRealCentimos).toBe(-1090);
    expect(linea.margenProyectadoCentimos).toBe(-990);
    expect(linea.causaPerdida).toBe('AMBAS');
    expect(linea.alerta).toBe(true);
  });

  it('PA-CU18-02 Microsoft sin miembros pierde por TARIFA', async () => {
    await suscripcion('Microsoft', 'Microsoft 365', '37.99', 6);
    await generarPeriodo(db, '2026-11-01');

    const lineas = await informeSuscripciones(db, '2026-11-01', 'PEN');
    const linea = lineas.find((l) => l.nombre === 'Microsoft 365')!;

    expect(linea.esperadoCentimos).toBe(0);
    expect(linea.cobradoCentimos).toBe(0);
    expect(linea.margenRealCentimos).toBe(-3799);
    expect(linea.causaPerdida).toBe('TARIFA');

    const perdidas = await informePerdidasSuscripciones(
      db,
      '2026-11-01',
      'PEN',
    );
    expect(perdidas.some((l) => l.nombre === 'Microsoft 365')).toBe(true);
  });

  it('PA-CU18-03 detecta morosidad pura', async () => {
    const persona1 = await persona('Ana', 'Alvarez');
    const plan = await suscripcion('Microsoft', 'Plan 30', '30.00', 5);
    await miembro(plan.id, persona1.id, '30.00');
    await generarPeriodo(db, '2026-11-01');
    await pagarCargo(persona1.id, (await cargoDe(persona1.id)).id, '20.00');

    const lineas = await informeSuscripciones(db, '2026-11-01', 'PEN');
    const linea = lineas.find((l) => l.suscripcionId === plan.id)!;

    expect(linea.margenRealCentimos).toBe(-1000);
    expect(linea.causaPerdida).toBe('MOROSIDAD');
  });

  it('PA-CU18-04 no reporta pérdida cuando lo cobrado cubre el costo', async () => {
    const persona1 = await persona('Beto', 'Benitez');
    const plan = await suscripcion('Microsoft', 'Plan 30', '30.00', 5);
    await miembro(plan.id, persona1.id, '30.00');
    await generarPeriodo(db, '2026-11-01');
    await pagarCargo(persona1.id, (await cargoDe(persona1.id)).id, '30.00');

    const lineas = await informeSuscripciones(db, '2026-11-01', 'PEN');
    const linea = lineas.find((l) => l.suscripcionId === plan.id)!;
    expect(linea.causaPerdida).toBeNull();

    const perdidas = await informePerdidasSuscripciones(
      db,
      '2026-11-01',
      'PEN',
    );
    expect(perdidas.some((l) => l.suscripcionId === plan.id)).toBe(false);
  });

  it('PA-CU18-05 detalla por miembro y marca aportes bajo el costo por plaza', async () => {
    const nayeli = await persona('Nayeli', 'Zapata Yamo');
    const ernesto = await persona('Ernesto', 'Quispe Huaman');
    const bajo = await persona('Carla', 'Castillo');
    const youtube = await suscripcion('YouTube', 'YouTube Premium', '53.90', 6);
    await miembro(youtube.id, nayeli.id, '15.00');
    await miembro(youtube.id, ernesto.id, '15.00');
    await miembro(youtube.id, bajo.id, '5.00');
    await generarPeriodo(db, '2026-11-01');
    await pagarCargo(ernesto.id, (await cargoDe(ernesto.id)).id, '14.00');

    const lineas = await informeSuscripciones(db, '2026-11-01', 'PEN');
    const linea = lineas.find((l) => l.suscripcionId === youtube.id)!;

    const detalleErnesto = linea.miembros.find(
      (m) => m.personaId === ernesto.id,
    )!;
    expect(detalleErnesto.saldoCentimos).toBe(100);
    expect(detalleErnesto.costoPorPlazaCentimos).toBe(898);

    const detalleBajo = linea.miembros.find((m) => m.personaId === bajo.id)!;
    expect(detalleBajo.aportaMenosQueCosto).toBe(true);
    expect(
      linea.miembros
        .filter((m) => m.personaId !== bajo.id)
        .every((m) => !m.aportaMenosQueCosto),
    ).toBe(true);
  });

  it('PA-CU18-06 la suscripción de uso personal no genera alerta de pérdida', async () => {
    const obsidian = await suscripcion(
      'Obsidian',
      'Obsidian Sync',
      '18.00',
      1,
      true,
    );
    await generarPeriodo(db, '2026-11-01');

    const lineas = await informeSuscripciones(db, '2026-11-01', 'PEN');
    const linea = lineas.find((l) => l.suscripcionId === obsidian.id)!;
    expect(linea.margenRealCentimos).toBe(-1800);
    expect(linea.esUsoPersonal).toBe(true);
    expect(linea.alerta).toBe(false);

    const perdidas = await informePerdidasSuscripciones(
      db,
      '2026-11-01',
      'PEN',
    );
    expect(perdidas.some((l) => l.suscripcionId === obsidian.id)).toBe(false);
  });

  it('exporta el informe de suscripciones a CSV', async () => {
    await suscripcion('Microsoft', 'Microsoft 365', '37.99', 6);
    await generarPeriodo(db, '2026-11-01');
    const csv = suscripcionesACsv(
      await informeSuscripciones(db, '2026-11-01', 'PEN'),
    );

    expect(csv.split('\r\n')).toHaveLength(2);
    expect(csv).toContain('Microsoft 365');
    expect(csv).toContain('37.99');
    expect(csv).toContain('TARIFA');
  });
});
