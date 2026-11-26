import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../infraestructura/persistencia/baseDatos';
import {
  anularPago,
  listarPagos,
  registrarPago,
} from '../aplicacion/pagos';
import { registrarPersona } from '../aplicacion/personas';
import { crearPrestamo } from '../aplicacion/prestamos';
import { cargarAuxiliaresSaldos } from '../aplicacion/saldos';
import { ErrorReglaNegocio, ErrorValidacion } from '../dominio/errores';
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

describe('CU-15 Anular pago', () => {
  it('PA-CU15-01 anula un pago aplicado a dos cuotas y recalcula estados', async () => {
    const { prestamo } = await pm2();
    const { pago } = await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-10-05',
      monto: '500.00',
      metodoPago: 'EFECTIVO',
    });

    const antes = await db.cuotasPrestamo
      .where('prestamoId')
      .equals(prestamo.id)
      .toArray();
    expect(antes.find((c) => c.numeroCuota === 1)?.estado).toBe('PAGADA');
    expect(antes.find((c) => c.numeroCuota === 2)?.estado).toBe('PARCIAL');

    await anularPago(db, pago.id, 'Error de registro');

    const despues = await db.cuotasPrestamo
      .where('prestamoId')
      .equals(prestamo.id)
      .toArray();
    expect(despues.find((c) => c.numeroCuota === 1)?.estado).toBe('PENDIENTE');
    expect(despues.find((c) => c.numeroCuota === 2)?.estado).toBe('PENDIENTE');
  });

  it('PA-CU15-02 reabre un préstamo cancelado al anular su último pago', async () => {
    const persona = await titular();
    const { prestamo } = await crearPrestamo(db, {
      personaId: persona.id,
      moneda: 'PEN',
      capital: '1000.00',
      tasaMensual: 0,
      plazoMeses: 1,
      fechaPrestamo: '2026-10-01',
      estrictoCumplimiento: false,
    });
    const { pago } = await registrarPago(db, {
      personaId: persona.id,
      moneda: 'PEN',
      fechaPago: '2026-11-01',
      monto: '1000.00',
      metodoPago: 'EFECTIVO',
    });
    expect((await db.prestamos.get(prestamo.id))?.estado).toBe('CANCELADO');

    await anularPago(db, pago.id, 'Pago duplicado');

    expect((await db.prestamos.get(prestamo.id))?.estado).toBe('ACTIVO');
  });

  it('PA-CU15-03 exige motivo', async () => {
    const { prestamo } = await pm2();
    const { pago } = await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-10-05',
      monto: '100.00',
      metodoPago: 'EFECTIVO',
    });

    await expect(anularPago(db, pago.id, '  ')).rejects.toBeInstanceOf(
      ErrorValidacion,
    );
    expect((await db.pagos.get(pago.id))?.estado).toBe('REGISTRADO');
  });

  it('PA-CU15-04 rechaza anular dos veces', async () => {
    const { prestamo } = await pm2();
    const { pago } = await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-10-05',
      monto: '100.00',
      metodoPago: 'EFECTIVO',
    });
    await anularPago(db, pago.id, 'Motivo');
    await expect(anularPago(db, pago.id, 'Motivo')).rejects.toBeInstanceOf(
      ErrorReglaNegocio,
    );
  });

  it('PA-CU15-05 el pago anulado deja de contar en cobros y saldos', async () => {
    const { prestamo } = await pm2();
    const { pago } = await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-10-05',
      monto: '500.00',
      metodoPago: 'EFECTIVO',
    });
    await anularPago(db, pago.id, 'Motivo');

    const aux = await cargarAuxiliaresSaldos(db);
    const totalAplicado = aux.aplicaciones
      .filter((a) => aux.pagosRegistrados.has(a.pagoId))
      .reduce((t, a) => t + a.montoAplicadoCentimos, 0);
    expect(totalAplicado).toBe(0);
    expect(await listarPagos(db, { estado: 'REGISTRADO' })).toHaveLength(0);
  });

  it('PA-CU15-06 conserva pago, comprobante y auditoría', async () => {
    const { prestamo } = await pm2();
    const comprobante = {
      imagen: new Blob(['imagen']),
      mimeType: 'image/png',
      ancho: 100,
      alto: 100,
      sha256: 'b'.repeat(64),
    };
    const { pago } = await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-10-05',
      monto: '100.00',
      metodoPago: 'EFECTIVO',
      comprobantes: [comprobante],
    });

    await anularPago(db, pago.id, 'Error de caja', 'usuario-1');

    expect(await db.pagos.get(pago.id)).toBeDefined();
    expect(await db.comprobantesPago.count()).toBe(1);
    const auditoria = await db.auditoria
      .where('entidadId')
      .equals(pago.id)
      .toArray();
    const anulacion = auditoria.find((a) => a.accion === 'ANULAR');
    expect(anulacion).toBeDefined();
    expect(anulacion?.usuarioId).toBe('usuario-1');
    expect(
      (anulacion?.despues as { motivo: string }).motivo,
    ).toBe('Error de caja');
  });
});
