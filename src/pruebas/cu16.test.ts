import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import {
  anularPago,
  listarPagos,
  obtenerComprobanteDePersona,
  obtenerComprobantes,
  obtenerPagoDePersona,
  registrarPago,
} from '../aplicacion/pagos';
import { registrarPersona } from '../aplicacion/personas';
import { crearPrestamo } from '../aplicacion/prestamos';
import { crearSuscripcion } from '../aplicacion/suscripciones';
import { agregarMiembro } from '../aplicacion/miembros';
import { ErrorNoEncontrado } from '../dominio/errores';
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

async function cargos(personaId: string, periodos: string[]) {
  const plataforma = await db.plataformas
    .filter((p) => p.nombre === 'YouTube')
    .first();
  const suscripcion = await crearSuscripcion(db, {
    plataformaId: plataforma!.id,
    nombre: 'YouTube Premium',
    moneda: 'PEN',
    costo: '53.90',
    capacidad: 6,
    diaCobro: 5,
    fechaInicio: '2026-01-01',
  });
  const agregado = await agregarMiembro(db, suscripcion.id, {
    personaId,
    montoAcordado: '15.00',
    fechaInicio: '2026-01-01',
  });
  for (const periodo of periodos) {
    await db.cargosSuscripcion.add({
      id: nuevoId(),
      miembroId: agregado.miembro.id,
      periodo,
      montoCentimos: 1500,
      fechaVencimiento: `${periodo.slice(0, 8)}05`,
      estado: 'PENDIENTE',
    });
  }
  return suscripcion;
}

async function escenario() {
  const ernesto = await persona('Ernesto', 'Quispe Huaman');
  const nayeli = await persona('Nayeli', 'Zapata Yamo');
  await cargos(ernesto.id, ['2026-10-01', '2026-11-01']);
  await cargos(nayeli.id, ['2026-11-01']);

  const pago1 = await registrarPago(db, {
    personaId: ernesto.id,
    moneda: 'PEN',
    fechaPago: '2026-10-05',
    monto: '15.00',
    metodoPago: 'EFECTIVO',
  });
  const pago2 = await registrarPago(db, {
    personaId: ernesto.id,
    moneda: 'PEN',
    fechaPago: '2026-11-05',
    monto: '15.00',
    metodoPago: 'YAPE',
    comprobantes: [
      {
        imagen: new Blob(['comprobante']),
        mimeType: 'image/png',
        ancho: 100,
        alto: 100,
        sha256: 'c'.repeat(64),
      },
    ],
  });
  await crearPrestamo(db, {
    personaId: ernesto.id,
    moneda: 'PEN',
    capital: '2000.00',
    tasaMensual: 5,
    plazoMeses: 6,
    fechaPrestamo: '2026-09-01',
    estrictoCumplimiento: false,
  });
  const pago3 = await registrarPago(db, {
    personaId: ernesto.id,
    moneda: 'PEN',
    fechaPago: '2026-11-10',
    monto: '100.00',
    metodoPago: 'EFECTIVO',
  });
  const pago4 = await registrarPago(db, {
    personaId: nayeli.id,
    moneda: 'PEN',
    fechaPago: '2026-11-12',
    monto: '15.00',
    metodoPago: 'EFECTIVO',
  });

  return { ernesto, nayeli, pago1, pago2, pago3, pago4 };
}

describe('CU-16 Historial de pagos', () => {
  it('PA-CU16-01 filtra por persona, tipo, método, fechas y estado', async () => {
    const { ernesto, pago2 } = await escenario();

    expect(await listarPagos(db, { personaId: ernesto.id })).toHaveLength(3);
    expect(await listarPagos(db, { tipo: 'PRESTAMO' })).toHaveLength(1);
    expect(await listarPagos(db, { metodoPago: 'YAPE' })).toHaveLength(1);
    expect(
      await listarPagos(db, { desde: '2026-11-01', hasta: '2026-11-30' }),
    ).toHaveLength(3);
    expect(await listarPagos(db, { estado: 'REGISTRADO' })).toHaveLength(4);

    await anularPago(db, pago2.pago.id, 'Anulación de prueba');

    expect(await listarPagos(db, { estado: 'ANULADO' })).toHaveLength(1);
    expect(await listarPagos(db, { estado: 'REGISTRADO' })).toHaveLength(3);
  });

  it('PA-CU16-02 la vista por persona solo muestra sus pagos', async () => {
    const { ernesto, pago4 } = await escenario();

    const propios = await listarPagos(db, { personaId: ernesto.id });
    expect(propios.every((p) => p.personaId === ernesto.id)).toBe(true);
    expect(propios.some((p) => p.id === pago4.pago.id)).toBe(false);
  });

  it('PA-CU16-03 un pago ajeno se comporta como inexistente', async () => {
    const { ernesto, pago4 } = await escenario();

    await expect(
      obtenerPagoDePersona(db, pago4.pago.id, ernesto.id),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado);

    const propio = await obtenerPagoDePersona(
      db,
      pago4.pago.id,
      pago4.pago.personaId,
    );
    expect(propio.id).toBe(pago4.pago.id);
  });

  it('PA-CU16-04 abre el comprobante propio y rechaza el ajeno', async () => {
    const { ernesto, nayeli, pago2 } = await escenario();
    const comprobantes = await obtenerComprobantes(db, pago2.pago.id);

    expect(comprobantes).toHaveLength(1);
    expect(comprobantes[0]?.imagen.size).toBeGreaterThan(0);
    expect(comprobantes[0]?.ancho).toBe(100);

    const propio = await obtenerComprobanteDePersona(
      db,
      pago2.pago.id,
      comprobantes[0]!.id,
      ernesto.id,
    );
    expect(propio.id).toBe(comprobantes[0]?.id);

    await expect(
      obtenerComprobanteDePersona(
        db,
        pago2.pago.id,
        comprobantes[0]!.id,
        nayeli.id,
      ),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });
});
