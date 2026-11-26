import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../infraestructura/persistencia/baseDatos';
import { consultarVistaPersona } from '../aplicacion/portal';
import {
  obtenerComprobanteDePersona,
  obtenerPagoDePersona,
  obtenerObligacionesPendientes,
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

async function cargoPara(personaId: string, periodo = '2026-10-01') {
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
    montoAcordado: '30.00',
    fechaInicio: '2026-01-01',
  });
  await db.cargosSuscripcion.add({
    id: nuevoId(),
    miembroId: agregado.miembro.id,
    periodo,
    montoCentimos: 3000,
    fechaVencimiento: '2026-10-05',
    estado: 'PENDIENTE',
  });
  return { suscripcion, miembro: agregado.miembro };
}

describe('CU-22 Vista por persona (portal local de solo lectura)', () => {
  it('PA-CU22-01 muestra solo el resumen de la persona elegida', async () => {
    const a = await persona('Nayeli', 'Zapata Yamo');
    const b = await persona('Ernesto', 'Quispe Huaman');
    await cargoPara(a.id);
    await cargoPara(b.id, '2026-11-01');

    const cargoA = (
      await obtenerObligacionesPendientes(db, a.id, 'SUSCRIPCION')
    )[0]!;
    await registrarPago(db, {
      personaId: a.id,
      moneda: 'PEN',
      fechaPago: '2026-10-10',
      monto: '10.00',
      metodoPago: 'EFECTIVO',
      aplicaciones: [
        { tipo: 'SUSCRIPCION', obligacionId: cargoA.id, monto: '10.00' },
      ],
    });

    const prestamo = await crearPrestamo(db, {
      personaId: a.id,
      moneda: 'PEN',
      capital: '900.00',
      tasaMensual: 0,
      plazoMeses: 3,
      fechaPrestamo: '2026-09-01',
      fechaPrimerPago: '2026-10-01',
      estrictoCumplimiento: false,
    });
    const cuota = (
      await obtenerObligacionesPendientes(db, a.id, 'PRESTAMO')
    )[0]!;
    await registrarPago(db, {
      personaId: a.id,
      moneda: 'PEN',
      fechaPago: '2026-10-05',
      monto: '300.00',
      metodoPago: 'EFECTIVO',
      aplicaciones: [
        { tipo: 'PRESTAMO', obligacionId: cuota.id, monto: '300.00' },
      ],
    });

    const vista = await consultarVistaPersona(db, a.id);

    expect(vista.persona.id).toBe(a.id);
    expect(vista.puedeEditar).toBe(false);
    expect(vista.suscripciones).toHaveLength(1);
    expect(vista.suscripciones[0]?.saldoCentimos).toBe(2000);
    expect(vista.prestamos).toHaveLength(1);
    expect(vista.prestamos[0]?.id).toBe(prestamo.prestamo.id);
    expect(vista.prestamos[0]?.estado).toBe('ACTIVO');
    expect(vista.pagos).toHaveLength(2);
    expect(vista.deudaPorMoneda[0]?.centimos).toBe(62000);
    expect(
      vista.prestamos[0]?.cuotas.filter((c) => c.estado === 'PAGADA'),
    ).toHaveLength(1);
    expect(
      vista.prestamos[0]?.cuotas.filter((c) => c.estado === 'PENDIENTE'),
    ).toHaveLength(2);

    const vistaB = await consultarVistaPersona(db, b.id);
    expect(vistaB.prestamos).toHaveLength(0);
    expect(vistaB.pagos).toHaveLength(0);
    expect(vistaB.suscripciones[0]?.saldoCentimos).toBe(3000);
  });

  it('PA-CU22-02 un identificador de otra persona no revela datos', async () => {
    const a = await persona('Nayeli', 'Zapata Yamo');
    const b = await persona('Ernesto', 'Quispe Huaman');
    await cargoPara(a.id);

    await expect(
      consultarVistaPersona(db, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado);

    const cargoA = (
      await obtenerObligacionesPendientes(db, a.id, 'SUSCRIPCION')
    )[0]!;
    const pago = await registrarPago(db, {
      personaId: a.id,
      moneda: 'PEN',
      fechaPago: '2026-10-10',
      monto: '30.00',
      metodoPago: 'EFECTIVO',
      aplicaciones: [
        { tipo: 'SUSCRIPCION', obligacionId: cargoA.id, monto: '30.00' },
      ],
    });

    await expect(
      obtenerPagoDePersona(db, pago.pago.id, b.id),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  it('PA-CU22-03 la vista no ofrece acciones de escritura', async () => {
    const a = await persona('Nayeli', 'Zapata Yamo');
    const vista = await consultarVistaPersona(db, a.id);
    expect(vista.puedeEditar).toBe(false);
  });

  it('PA-CU22-04 el comprobante ajeno no es accesible desde la vista', async () => {
    const a = await persona('Nayeli', 'Zapata Yamo');
    const b = await persona('Ernesto', 'Quispe Huaman');
    await cargoPara(a.id);
    const cargoA = (
      await obtenerObligacionesPendientes(db, a.id, 'SUSCRIPCION')
    )[0]!;
    const pago = await registrarPago(db, {
      personaId: a.id,
      moneda: 'PEN',
      fechaPago: '2026-10-10',
      monto: '30.00',
      metodoPago: 'EFECTIVO',
      comprobantes: [
        {
          imagen: new Blob(['imagen']),
          mimeType: 'image/png',
          ancho: 100,
          alto: 100,
          sha256: 'd'.repeat(64),
        },
      ],
      aplicaciones: [
        { tipo: 'SUSCRIPCION', obligacionId: cargoA.id, monto: '30.00' },
      ],
    });
    const comprobante = (
      await db.comprobantesPago.where('pagoId').equals(pago.pago.id).toArray()
    )[0]!;

    await expect(
      obtenerComprobanteDePersona(db, pago.pago.id, comprobante.id, b.id),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado);
    const propio = await obtenerComprobanteDePersona(
      db,
      pago.pago.id,
      comprobante.id,
      a.id,
    );
    expect(propio.id).toBe(comprobante.id);
  });

  it('PA-CU22-05 muestra cuotas pagadas y pendientes sin permitir ajustes', async () => {
    const a = await persona('Nayeli', 'Zapata Yamo');
    const prestamo = await crearPrestamo(db, {
      personaId: a.id,
      moneda: 'PEN',
      capital: '900.00',
      tasaMensual: 0,
      plazoMeses: 3,
      fechaPrestamo: '2026-09-01',
      fechaPrimerPago: '2026-10-01',
      estrictoCumplimiento: true,
    });

    const vista = await consultarVistaPersona(db, a.id);
    const linea = vista.prestamos.find(
      (p) => p.id === prestamo.prestamo.id,
    )!;
    expect(linea.cuotas).toHaveLength(3);
    expect(linea.cuotas.every((c) => c.estado === 'PENDIENTE')).toBe(true);
    expect(vista.puedeEditar).toBe(false);
  });
});
