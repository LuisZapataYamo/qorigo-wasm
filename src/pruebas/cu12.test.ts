import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import {
  obtenerObligacionesPendientes,
  registrarPago,
} from '../aplicacion/pagos';
import { registrarPersona } from '../aplicacion/personas';
import { crearPrestamo } from '../aplicacion/prestamos';
import { crearSuscripcion } from '../aplicacion/suscripciones';
import { agregarMiembro } from '../aplicacion/miembros';
import { cargarAuxiliaresSaldos, pagadoDeCuota } from '../aplicacion/saldos';
import { ErrorNoEncontrado, ErrorReglaNegocio, ErrorValidacion } from '../dominio/errores';
import { nuevoId } from '../dominio/ids';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function persona(nombres = 'Ernesto', apellidos = 'Quispe Huaman') {
  const alta = await registrarPersona(
    db,
    { nombres, apellidos },
    { resolucionSimilar: 'crear' },
  );
  return alta.persona!;
}

async function suscripcionConCargos(
  personaId: string,
  montos: number[],
  periodos = ['2026-10-01'],
) {
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
  for (let i = 0; i < montos.length; i++) {
    await db.cargosSuscripcion.add({
      id: nuevoId(),
      miembroId: agregado.miembro.id,
      periodo: periodos[i],
      montoCentimos: montos[i],
      fechaVencimiento: `${periodos[i].slice(0, 8)}05`,
      estado: 'PENDIENTE',
    });
  }
  return { suscripcion, miembro: agregado.miembro };
}

async function pm2(moneda = 'PEN') {
  const titular = await persona();
  return crearPrestamo(db, {
    personaId: titular.id,
    moneda,
    capital: '2000.00',
    tasaMensual: 5,
    plazoMeses: 6,
    fechaPrestamo: '2026-09-01',
    estrictoCumplimiento: false,
  });
}

describe('CU-12 Registrar pago', () => {
  it('PA-CU12-01 deja el cargo en PARCIAL cuando el pago es menor', async () => {
    const titular = await persona();
    await suscripcionConCargos(titular.id, [1500]);

    const resultado = await registrarPago(db, {
      personaId: titular.id,
      moneda: 'PEN',
      fechaPago: '2026-11-01',
      monto: '14.00',
      metodoPago: 'EFECTIVO',
    });

    expect(resultado.aplicaciones).toHaveLength(1);
    expect(resultado.remanenteCentimos).toBe(0);
    const cargo = (await db.cargosSuscripcion.toArray())[0];
    expect(cargo?.estado).toBe('PARCIAL');
    const obligaciones = await obtenerObligacionesPendientes(db, titular.id);
    expect(obligaciones[0]?.saldoCentimos).toBe(100);
  });

  it('PA-CU12-02 un pago puede cubrir dos cargos', async () => {
    const titular = await persona();
    await suscripcionConCargos(
      titular.id,
      [1500, 1500],
      ['2026-10-01', '2026-11-01'],
    );

    const resultado = await registrarPago(db, {
      personaId: titular.id,
      moneda: 'PEN',
      fechaPago: '2026-11-15',
      monto: '30.00',
      metodoPago: 'EFECTIVO',
    });

    expect(resultado.aplicaciones).toHaveLength(2);
    expect(resultado.remanenteCentimos).toBe(0);
    const cargos = await db.cargosSuscripcion.toArray();
    expect(cargos.every((c) => c.estado === 'PAGADO')).toBe(true);
  });

  it('PA-CU12-03 informa el remanente sin aplicar', async () => {
    const titular = await persona();
    await suscripcionConCargos(
      titular.id,
      [1500, 1500],
      ['2026-10-01', '2026-11-01'],
    );

    const resultado = await registrarPago(db, {
      personaId: titular.id,
      moneda: 'PEN',
      fechaPago: '2026-11-15',
      monto: '35.00',
      metodoPago: 'EFECTIVO',
    });

    expect(resultado.remanenteCentimos).toBe(500);
    expect(resultado.aplicaciones).toHaveLength(2);
  });

  it('PA-CU12-04 filtra las obligaciones por tipo', async () => {
    const titular = await persona();
    await suscripcionConCargos(titular.id, [1500]);
    await crearPrestamo(db, {
      personaId: titular.id,
      moneda: 'PEN',
      capital: '1000.00',
      tasaMensual: 5,
      plazoMeses: 2,
      fechaPrestamo: '2026-11-01',
      estrictoCumplimiento: false,
    });

    const soloCargos = await obtenerObligacionesPendientes(
      db,
      titular.id,
      'SUSCRIPCION',
    );
    const soloCuotas = await obtenerObligacionesPendientes(
      db,
      titular.id,
      'PRESTAMO',
    );

    expect(soloCargos).toHaveLength(1);
    expect(soloCargos[0]?.tipo).toBe('SUSCRIPCION');
    expect(soloCuotas).toHaveLength(2);
    expect(soloCuotas.every((o) => o.tipo === 'PRESTAMO')).toBe(true);
  });

  it('PA-CU12-05 rechaza montos cero o negativos', async () => {
    const titular = await persona();
    for (const monto of ['0', '-1']) {
      await expect(
        registrarPago(db, {
          personaId: titular.id,
          moneda: 'PEN',
          fechaPago: '2026-11-01',
          monto,
          metodoPago: 'EFECTIVO',
        }),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    }
  });

  it('PA-CU12-06 rechaza un pago en moneda distinta', async () => {
    const { prestamo } = await pm2('USD');
    await expect(
      registrarPago(db, {
        personaId: prestamo.personaId,
        moneda: 'PEN',
        fechaPago: '2026-11-01',
        monto: '100.00',
        metodoPago: 'EFECTIVO',
      }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('PA-CU12-07 rechaza aplicar a una obligación de otra persona', async () => {
    const ernesto = await persona();
    const nayeli = await persona('Nayeli', 'Zapata Yamo');
    await suscripcionConCargos(nayeli.id, [1500]);
    const cargo = (await db.cargosSuscripcion.toArray())[0];

    await expect(
      registrarPago(db, {
        personaId: ernesto.id,
        moneda: 'PEN',
        fechaPago: '2026-11-01',
        monto: '15.00',
        metodoPago: 'EFECTIVO',
        aplicaciones: [
          { tipo: 'SUSCRIPCION', obligacionId: cargo.id, monto: '15.00' },
        ],
      }),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  it('PA-CU12-08 rechaza una aplicación mayor al saldo', async () => {
    const titular = await persona();
    await suscripcionConCargos(titular.id, [1500]);
    const cargo = (await db.cargosSuscripcion.toArray())[0];

    await expect(
      registrarPago(db, {
        personaId: titular.id,
        moneda: 'PEN',
        fechaPago: '2026-11-01',
        monto: '20.00',
        metodoPago: 'EFECTIVO',
        aplicaciones: [
          { tipo: 'SUSCRIPCION', obligacionId: cargo.id, monto: '20.00' },
        ],
      }),
    ).rejects.toBeInstanceOf(ErrorReglaNegocio);
  });

  it('PA-CU12-09 dos pagos de 434 cubren dos cuotas y abonan 1.34 a la tercera', async () => {
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

    const cuotas = await db.cuotasPrestamo
      .where('prestamoId')
      .equals(prestamo.id)
      .toArray();
    const ordenadas = cuotas.sort((a, b) => a.numeroCuota - b.numeroCuota);
    expect(ordenadas[0]?.estado).toBe('PAGADA');
    expect(ordenadas[1]?.estado).toBe('PAGADA');
    expect(ordenadas[2]?.estado).toBe('PARCIAL');

    const aux = await cargarAuxiliaresSaldos(db);
    expect(pagadoDeCuota(aux, ordenadas[2]!.id)).toBe(134);
    expect(
      (await db.aplicacionesPago.toArray()).reduce(
        (total, a) => total + a.montoAplicadoCentimos,
        0,
      ),
    ).toBe(86800);
  });

  it('PA-CU12-10 reparte capital e interés al pagar una cuota completa', async () => {
    const { prestamo } = await pm2();
    const resultado = await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-10-01',
      monto: '433.33',
      metodoPago: 'EFECTIVO',
    });

    expect(resultado.aplicaciones[0]?.montoCapitalCentimos).toBe(33333);
    expect(resultado.aplicaciones[0]?.montoInteresCentimos).toBe(10000);
  });

  it('PA-CU12-11 reparte proporcionalmente en un pago parcial', async () => {
    const { prestamo } = await pm2();
    const resultado = await registrarPago(db, {
      personaId: prestamo.personaId,
      moneda: 'PEN',
      fechaPago: '2026-10-01',
      monto: '200.00',
      metodoPago: 'EFECTIVO',
    });

    expect(resultado.aplicaciones[0]?.montoCapitalCentimos).toBe(15385);
    expect(resultado.aplicaciones[0]?.montoInteresCentimos).toBe(4615);
  });

  it('PA-CU12-12 cancela el préstamo al pagar la última cuota', async () => {
    const titular = await persona();
    const { prestamo } = await crearPrestamo(db, {
      personaId: titular.id,
      moneda: 'PEN',
      capital: '1000.00',
      tasaMensual: 0,
      plazoMeses: 1,
      fechaPrestamo: '2026-10-01',
      estrictoCumplimiento: false,
    });

    await registrarPago(db, {
      personaId: titular.id,
      moneda: 'PEN',
      fechaPago: '2026-11-01',
      monto: '1000.00',
      metodoPago: 'EFECTIVO',
    });

    expect((await db.prestamos.get(prestamo.id))?.estado).toBe('CANCELADO');
  });

  it('PA-CU12-13 revierte el pago si falla la inserción del comprobante', async () => {
    const titular = await persona();
    await suscripcionConCargos(titular.id, [1500]);

    await expect(
      registrarPago(
        db,
        {
          personaId: titular.id,
          moneda: 'PEN',
          fechaPago: '2026-11-01',
          monto: '15.00',
          metodoPago: 'YAPE',
          comprobantes: [
            {
              imagen: new Blob(['comprobante']),
              mimeType: 'image/png',
              ancho: 100,
              alto: 100,
              sha256: 'a'.repeat(64),
            },
          ],
        },
        {
          alInsertarComprobante: () => {
            throw new Error('Fallo simulado');
          },
        },
      ),
    ).rejects.toThrow(/Fallo simulado/);

    expect(await db.pagos.count()).toBe(0);
    expect(await db.aplicacionesPago.count()).toBe(0);
    expect(await db.comprobantesPago.count()).toBe(0);
    expect((await db.cargosSuscripcion.toArray())[0]?.estado).toBe(
      'PENDIENTE',
    );
  });
});
