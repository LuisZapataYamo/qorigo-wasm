import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../infraestructura/persistencia/baseDatos';
import {
  anularPrestamo,
  crearPrestamo,
  cuotasDePrestamo,
  marcarIncobrable,
  resumenPrestamo,
} from '../aplicacion/prestamos';
import { registrarPersona } from '../aplicacion/personas';
import { ErrorReglaNegocio, ErrorValidacion } from '../dominio/errores';
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

async function pm2() {
  const alta = await registrarPersona(
    db,
    { nombres: 'Ernesto', apellidos: 'Quispe Huaman' },
    { resolucionSimilar: 'crear' },
  );
  return crearPrestamo(db, {
    personaId: alta.persona!.id,
    moneda: 'PEN',
    capital: '2000.00',
    tasaMensual: 5,
    plazoMeses: 6,
    fechaPrestamo: '2026-09-01',
    estrictoCumplimiento: false,
  });
}

async function pagar868(
  prestamoId: string,
  personaId: string,
): Promise<void> {
  const cuotas = await cuotasDePrestamo(db, prestamoId);
  const pagoId = nuevoId();
  await db.pagos.add({
    id: pagoId,
    personaId,
    moneda: 'PEN',
    fechaPago: '2026-11-20',
    montoCentimos: 86800,
    metodoPago: 'EFECTIVO',
    estado: 'REGISTRADO',
    creadoEn: new Date().toISOString(),
  });
  const aplicaciones = [43333, 43333, 134];
  for (let i = 0; i < aplicaciones.length; i++) {
    await db.aplicacionesPago.add({
      id: nuevoId(),
      pagoId,
      cuotaId: cuotas[i].id,
      montoAplicadoCentimos: aplicaciones[i],
      montoCapitalCentimos: Math.round((aplicaciones[i] * 33333) / 43333),
      montoInteresCentimos:
        aplicaciones[i] - Math.round((aplicaciones[i] * 33333) / 43333),
    });
  }
}

describe('CU-11 Marcar incobrable y anular', () => {
  it('PA-CU11-01 marca incobrable y calcula la pérdida neta', async () => {
    fijarHoy('2026-11-24');
    const { prestamo } = await pm2();
    await pagar868(prestamo.id, prestamo.personaId);

    const actualizado = await marcarIncobrable(
      db,
      prestamo.id,
      'Cliente ilocalizable',
    );

    expect(actualizado.estado).toBe('INCOBRABLE');
    expect(actualizado.motivoEstado).toBe('Cliente ilocalizable');

    const resumen = await resumenPrestamo(db, prestamo.id);
    expect(resumen.totalCobradoCentimos).toBe(86800);
    expect(resumen.perdidaNetaCentimos).toBe(113200);
    expect(resumen.marca).toBe('EN_PERDIDA');
  });

  it('PA-CU11-02 exige el motivo', async () => {
    const { prestamo } = await pm2();
    await expect(
      marcarIncobrable(db, prestamo.id, '   '),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect((await db.prestamos.get(prestamo.id))?.estado).toBe('ACTIVO');
  });

  it('PA-CU11-03 no permite marcar incobrable un préstamo cancelado', async () => {
    const { prestamo } = await pm2();
    await db.prestamos.update(prestamo.id, { estado: 'CANCELADO' });

    await expect(
      marcarIncobrable(db, prestamo.id, 'Intento'),
    ).rejects.toBeInstanceOf(ErrorReglaNegocio);
  });

  it('PA-CU11-04 el préstamo incobrable queda como EN PÉRDIDA y deja de estar en riesgo', async () => {
    fijarHoy('2026-11-24');
    const { prestamo } = await pm2();
    await marcarIncobrable(db, prestamo.id, 'Incobrable');

    const resumen = await resumenPrestamo(db, prestamo.id);
    expect(resumen.saldoVencidoCentimos).toBeGreaterThan(0);
    expect(resumen.marca).toBe('EN_PERDIDA');
  });

  it('PA-CU11-05 anula un préstamo sin pagos', async () => {
    const { prestamo } = await pm2();

    const anulado = await anularPrestamo(db, prestamo.id, 'Registrado por error');

    expect(anulado.estado).toBe('ANULADO');
    const auditoria = await db.auditoria
      .where('entidadId')
      .equals(prestamo.id)
      .toArray();
    expect(auditoria.some((a) => a.accion === 'ANULAR')).toBe(true);
  });

  it('PA-CU11-06 rechaza anular un préstamo con pagos activos', async () => {
    const { prestamo } = await pm2();
    await pagar868(prestamo.id, prestamo.personaId);

    await expect(anularPrestamo(db, prestamo.id)).rejects.toBeInstanceOf(
      ErrorReglaNegocio,
    );
    expect((await db.prestamos.get(prestamo.id))?.estado).toBe('ACTIVO');
  });
});
