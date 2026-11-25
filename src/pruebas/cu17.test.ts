import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import { DEFINICIONES, dashboard, balanceMensual, serieBalance } from '../aplicacion/reportes';
import { generarPeriodo } from '../aplicacion/cargos';
import { agregarMiembro } from '../aplicacion/miembros';
import { registrarPersona } from '../aplicacion/personas';
import { crearPrestamo } from '../aplicacion/prestamos';
import { crearSuscripcion } from '../aplicacion/suscripciones';
import { fijarHoy } from '../dominio/fechas';
import { nuevoId } from '../dominio/ids';
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
  });
}

async function insertarPago(
  personaId: string,
  fechaPago: string,
  montoCentimos: number,
  aplicaciones: Array<{
    cargoId?: string;
    cuotaId?: string;
    montoCentimos: number;
    capitalCentimos?: number;
    interesCentimos?: number;
  }>,
) {
  const pagoId = nuevoId();
  await db.pagos.add({
    id: pagoId,
    personaId,
    moneda: 'PEN',
    fechaPago,
    montoCentimos,
    metodoPago: 'EFECTIVO',
    estado: 'REGISTRADO',
    creadoEn: new Date().toISOString(),
  });
  for (const aplicacion of aplicaciones) {
    await db.aplicacionesPago.add({
      id: nuevoId(),
      pagoId,
      cargoId: aplicacion.cargoId,
      cuotaId: aplicacion.cuotaId,
      montoAplicadoCentimos: aplicacion.montoCentimos,
      montoCapitalCentimos: aplicacion.capitalCentimos,
      montoInteresCentimos: aplicacion.interesCentimos,
    });
  }
}

async function escenarioNoviembre() {
  const nayeli = await persona('Nayeli', 'Zapata Yamo');
  const ernesto = await persona('Ernesto', 'Quispe Huaman');
  const angelica = await persona('Angelica', 'Zapata Yamo');

  const youtube = await suscripcion('YouTube', 'YouTube Premium', '53.90', 6);
  await agregarMiembro(db, youtube.id, {
    personaId: nayeli.id,
    montoAcordado: '15.00',
    fechaInicio: '2026-01-01',
  });
  await agregarMiembro(db, youtube.id, {
    personaId: ernesto.id,
    montoAcordado: '15.00',
    fechaInicio: '2026-01-01',
  });
  await agregarMiembro(db, youtube.id, {
    personaId: angelica.id,
    montoAcordado: '14.00',
    fechaInicio: '2026-01-01',
  });
  await suscripcion('Microsoft', 'Microsoft 365', '37.99', 6);
  await suscripcion('Obsidian', 'Obsidian Sync', '18.00', 1);

  await generarPeriodo(db, '2026-11-01');

  const pm1 = await crearPrestamo(db, {
    personaId: ernesto.id,
    moneda: 'PEN',
    capital: '1500.00',
    tasaMensual: 10,
    plazoMeses: 2,
    fechaPrestamo: '2026-11-01',
    estrictoCumplimiento: true,
  });
  const pm2 = await crearPrestamo(db, {
    personaId: ernesto.id,
    moneda: 'PEN',
    capital: '2000.00',
    tasaMensual: 5,
    plazoMeses: 6,
    fechaPrestamo: '2026-09-01',
    estrictoCumplimiento: false,
  });
  const pm3 = await crearPrestamo(db, {
    personaId: angelica.id,
    moneda: 'PEN',
    capital: '800.00',
    tasaMensual: 0,
    plazoMeses: 1,
    fechaPrestamo: '2026-09-01',
    fechaPrimerPago: '2026-09-01',
    estrictoCumplimiento: true,
  });

  const cargos = await db.cargosSuscripcion
    .where('periodo')
    .equals('2026-11-01')
    .toArray();
  const miembros = await db.miembrosSuscripcion.toArray();
  const cargoDe = (personaId: string) =>
    cargos.find(
      (c) =>
        miembros.find((m) => m.id === c.miembroId)?.personaId === personaId,
    )!;

  await insertarPago(nayeli.id, '2026-11-10', 1500, [
    { cargoId: cargoDe(nayeli.id).id, montoCentimos: 1500 },
  ]);
  await insertarPago(ernesto.id, '2026-11-11', 1400, [
    { cargoId: cargoDe(ernesto.id).id, montoCentimos: 1400 },
  ]);
  await insertarPago(angelica.id, '2026-11-12', 1400, [
    { cargoId: cargoDe(angelica.id).id, montoCentimos: 1400 },
  ]);
  const cuota1 = await db.cuotasPrestamo
    .where('prestamoId')
    .equals(pm2.prestamo.id)
    .and((c) => c.numeroCuota === 1)
    .first();
  await insertarPago(ernesto.id, '2026-11-13', 43400, [
    {
      cuotaId: cuota1!.id,
      montoCentimos: 43333,
      capitalCentimos: 33333,
      interesCentimos: 10000,
    },
  ]);

  return { nayeli, ernesto, angelica, pm1, pm2, pm3 };
}

describe('CU-17 Dashboard y balance mensual', () => {
  it('PA-CU17-01 calcula el balance de caja de noviembre', async () => {
    fijarHoy('2026-11-24');
    await escenarioNoviembre();

    const balance = await balanceMensual(db, '2026-11-01', 'PEN');

    expect(balance.ingresoSuscripcionesCentimos).toBe(4300);
    expect(balance.ingresoPrestamosCentimos).toBe(43333);
    expect(balance.ingresosCentimos).toBe(47633);
    expect(balance.egresoCostosCentimos).toBe(10989);
    expect(balance.egresoDesembolsosCentimos).toBe(150000);
    expect(balance.egresosCentimos).toBe(160989);
    expect(balance.balanceCajaCentimos).toBe(-113356);
  });

  it('PA-CU17-02 separa la caja del resultado económico', async () => {
    fijarHoy('2026-11-24');
    await escenarioNoviembre();

    const balance = await balanceMensual(db, '2026-11-01', 'PEN');

    expect(balance.resultadoEconomicoCentimos).toBe(3311);
    expect(balance.balanceCajaCentimos).toBeLessThan(0);
    expect(balance.resultadoEconomicoCentimos).toBeGreaterThan(0);
  });

  it('PA-CU17-03 un mes sin datos devuelve ceros', async () => {
    const balance = await balanceMensual(db, '2025-01-01', 'PEN');

    expect(balance.ingresosCentimos).toBe(0);
    expect(balance.egresosCentimos).toBe(0);
    expect(balance.balanceCajaCentimos).toBe(0);
    expect(balance.resultadoEconomicoCentimos).toBe(0);
    expect(balance.rentabilidadPorcentaje).toBe(0);
  });

  it('PA-CU17-04 devuelve la serie de los últimos doce meses', async () => {
    fijarHoy('2026-11-24');
    await escenarioNoviembre();

    const serie = await serieBalance(db, '2026-11-01', 'PEN', 12);

    expect(serie).toHaveLength(12);
    expect(serie[0]?.periodo).toBe('2025-12-01');
    expect(serie[11]?.periodo).toBe('2026-11-01');
    expect(serie[11]?.ingresosCentimos).toBe(47633);
  });

  it('PA-CU17-05 no suma monedas distintas', async () => {
    fijarHoy('2026-11-24');
    const { ernesto } = await escenarioNoviembre();
    await crearPrestamo(db, {
      personaId: ernesto.id,
      moneda: 'USD',
      capital: '500.00',
      tasaMensual: 0,
      plazoMeses: 1,
      fechaPrestamo: '2026-11-10',
      estrictoCumplimiento: false,
    });

    const pen = await balanceMensual(db, '2026-11-01', 'PEN');
    const usd = await balanceMensual(db, '2026-11-01', 'USD');

    expect(pen.egresoDesembolsosCentimos).toBe(150000);
    expect(usd.egresoDesembolsosCentimos).toBe(50000);
    expect(usd.balanceCajaCentimos).toBe(-50000);
    expect(usd.ingresosCentimos).toBe(0);
  });

  it('PA-CU17-06 cada indicador tiene una definición', () => {
    for (const clave of [
      'balanceCaja',
      'resultadoEconomico',
      'capitalEnLaCalle',
      'exigible',
      'porcentajeCobranza',
      'rentabilidad',
    ]) {
      expect(DEFINICIONES[clave]?.length).toBeGreaterThan(20);
    }
  });

  it('PA-CU17-07 muestra alertas de pérdida, riesgo y vencimientos', async () => {
    fijarHoy('2026-11-24');
    await escenarioNoviembre();

    const tablero = await dashboard(db, '2026-11-01', 'PEN');

    expect(tablero.alertas.suscripcionesEnPerdida.length).toBeGreaterThan(0);
    expect(tablero.alertas.prestamosEnRiesgo.length).toBeGreaterThan(0);
    expect(tablero.indicadores.exigibleTotalCentimos).toBeGreaterThan(0);
    expect(tablero.indicadores.totalVencidoCentimos).toBeGreaterThan(0);
  });

  it('PA-CU17-08 responde en menos de dos segundos con el volumen de prueba', async () => {
    fijarHoy('2026-11-24');
    await escenarioNoviembre();

    const inicio = performance.now();
    await dashboard(db, '2026-11-01', 'PEN');
    const duracion = performance.now() - inicio;

    expect(duracion).toBeLessThan(2000);
  });
});
