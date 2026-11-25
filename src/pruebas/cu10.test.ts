import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import {
  ajustarCuota,
  cambiarCumplimiento,
  crearPrestamo,
  cuotasDePrestamo,
  exigibleDelMes,
} from '../aplicacion/prestamos';
import { registrarPersona } from '../aplicacion/personas';
import { ErrorReglaNegocio } from '../dominio/errores';
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

async function titular() {
  const alta = await registrarPersona(
    db,
    { nombres: 'Ernesto', apellidos: 'Quispe Huaman' },
    { resolucionSimilar: 'crear' },
  );
  return alta.persona!;
}

async function pm2(estricto = false) {
  const persona = await titular();
  return crearPrestamo(db, {
    personaId: persona.id,
    moneda: 'PEN',
    capital: '2000.00',
    tasaMensual: 5,
    plazoMeses: 6,
    fechaPrestamo: '2026-09-01',
    estrictoCumplimiento: estricto,
  });
}

describe('CU-10 Ajustar cuota en préstamo flexible', () => {
  it('PA-CU10-01 redistribuye equitativamente y conserva el total', async () => {
    const { prestamo } = await pm2(false);
    const cuotas = await cuotasDePrestamo(db, prestamo.id);

    await ajustarCuota(db, cuotas[2].id, {
      nuevoMonto: '300.00',
      motivo: 'Acuerdo con el cliente',
      redistribucion: 'EQUITATIVA',
    });

    const actualizadas = await cuotasDePrestamo(db, prestamo.id);
    expect(actualizadas.map((c) => c.montoProgramadoCentimos)).toEqual([
      43333, 43333, 30000, 47777, 47777, 47780,
    ]);
    expect(
      actualizadas.reduce((t, c) => t + c.montoProgramadoCentimos, 0),
    ).toBe(260000);
  });

  it('PA-CU10-02 guarda el histórico y conserva el monto original', async () => {
    const { prestamo } = await pm2(false);
    const cuotas = await cuotasDePrestamo(db, prestamo.id);

    await ajustarCuota(db, cuotas[2].id, {
      nuevoMonto: '300.00',
      motivo: 'Acuerdo con el cliente',
      usuarioId: 'usuario-1',
    });

    const ajustes = await db.cuotaAjustes
      .where('cuotaId')
      .equals(cuotas[2].id)
      .toArray();
    expect(ajustes.length).toBeGreaterThan(0);
    expect(ajustes[0]).toMatchObject({
      montoAnteriorCentimos: 43333,
      montoNuevoCentimos: 30000,
      motivo: 'Acuerdo con el cliente',
      usuarioId: 'usuario-1',
    });
    expect(ajustes[0]?.creadoEn).toBeTruthy();

    const despues = await cuotasDePrestamo(db, prestamo.id);
    expect(despues[2]?.montoOriginalCentimos).toBe(43333);
  });

  it('PA-CU10-03 rechaza ajustar un préstamo estricto', async () => {
    const { prestamo } = await pm2(true);
    const cuotas = await cuotasDePrestamo(db, prestamo.id);

    await expect(
      ajustarCuota(db, cuotas[0].id, {
        nuevoMonto: '300.00',
        motivo: 'Intento',
      }),
    ).rejects.toBeInstanceOf(ErrorReglaNegocio);
  });

  it('PA-CU10-04 rechaza un monto menor a lo ya aplicado', async () => {
    const { prestamo } = await pm2(false);
    const cuotas = await cuotasDePrestamo(db, prestamo.id);
    const pagoId = nuevoId();
    await db.pagos.add({
      id: pagoId,
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-11-10',
      montoCentimos: 200,
      metodoPago: 'EFECTIVO',
      estado: 'REGISTRADO',
      creadoEn: new Date().toISOString(),
    });
    await db.aplicacionesPago.add({
      id: nuevoId(),
      pagoId,
      cuotaId: cuotas[2].id,
      montoAplicadoCentimos: 200,
      montoCapitalCentimos: 154,
      montoInteresCentimos: 46,
    });

    await expect(
      ajustarCuota(db, cuotas[2].id, {
        nuevoMonto: '1.00',
        motivo: 'Intento',
      }),
    ).rejects.toBeInstanceOf(ErrorReglaNegocio);
  });

  it('PA-CU10-05 rechaza ajustar la última cuota', async () => {
    const { prestamo } = await pm2(false);
    const cuotas = await cuotasDePrestamo(db, prestamo.id);

    await expect(
      ajustarCuota(db, cuotas[5].id, {
        nuevoMonto: '500.00',
        motivo: 'Intento',
      }),
    ).rejects.toBeInstanceOf(ErrorReglaNegocio);
  });

  it('PA-CU10-06 rechaza ajustar una cuota pagada', async () => {
    const { prestamo } = await pm2(false);
    const cuotas = await cuotasDePrestamo(db, prestamo.id);
    await db.cuotasPrestamo.update(cuotas[0].id, { estado: 'PAGADA' });

    await expect(
      ajustarCuota(db, cuotas[0].id, {
        nuevoMonto: '100.00',
        motivo: 'Intento',
      }),
    ).rejects.toBeInstanceOf(ErrorReglaNegocio);
  });

  it('PA-CU10-07 cambiar la bandera se audita y solo afecta el exigible', async () => {
    fijarHoy('2026-11-15');
    const persona = await titular();
    const { prestamo } = await crearPrestamo(db, {
      personaId: persona.id,
      moneda: 'PEN',
      capital: '900.00',
      tasaMensual: 0,
      plazoMeses: 3,
      fechaPrestamo: '2026-09-01',
      fechaPrimerPago: '2026-10-01',
      estrictoCumplimiento: true,
    });

    const estricto = await exigibleDelMes(db, prestamo.id, '2026-11-01');
    expect(estricto.saldoAnteriorCentimos).toBe(30000);
    expect(estricto.cuotaMesCentimos).toBe(30000);
    expect(estricto.exigibleCentimos).toBe(60000);

    await cambiarCumplimiento(db, prestamo.id, false, 'usuario-1');

    const flexible = await exigibleDelMes(db, prestamo.id, '2026-11-01');
    expect(flexible.exigibleCentimos).toBe(30000);
    expect(flexible.atrasadoNoAcumuladoCentimos).toBe(30000);

    const auditoria = await db.auditoria
      .where('entidadId')
      .equals(prestamo.id)
      .toArray();
    const cambio = auditoria.find(
      (a) => a.accion === 'CAMBIAR_CUMPLIMIENTO',
    );
    expect(cambio).toBeDefined();
    expect(cambio?.despues).toEqual({ estrictoCumplimiento: false });
  });
});
