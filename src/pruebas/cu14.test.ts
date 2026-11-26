import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { BaseDatos } from '../infraestructura/persistencia/baseDatos';
import {
  procesarComprobante,
  type ComprobanteProcesado,
} from '../infraestructura/imagen/comprobantes';
import {
  listarPagos,
  obtenerComprobantes,
  registrarPago,
} from '../aplicacion/pagos';
import { registrarPersona } from '../aplicacion/personas';
import { crearSuscripcion } from '../aplicacion/suscripciones';
import { agregarMiembro } from '../aplicacion/miembros';
import { ErrorConflicto, ErrorValidacion } from '../dominio/errores';
import { nuevoId } from '../dominio/ids';
import { baseTemporal, destruirBase } from './util';
import { decodificarConSharp, leerPng, pixel } from './imagen';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function procesar(buffer: Buffer) {
  return procesarComprobante(new Blob([new Uint8Array(buffer)]), {
    decodificar: decodificarConSharp,
  });
}

async function personaConCargo() {
  const alta = await registrarPersona(db, {
    nombres: 'Ernesto',
    apellidos: 'Quispe Huaman',
  });
  const persona = alta.persona!;
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
    personaId: persona.id,
    montoAcordado: '15.00',
    fechaInicio: '2026-01-01',
  });
  await db.cargosSuscripcion.add({
    id: nuevoId(),
    miembroId: agregado.miembro.id,
    periodo: '2026-10-01',
    montoCentimos: 1500,
    fechaVencimiento: '2026-10-05',
    estado: 'PENDIENTE',
  });
  return persona;
}

const jpegGrande = async () =>
  sharp({
    create: {
      width: 3000,
      height: 4000,
      channels: 3,
      background: { r: 51, g: 102, b: 204 },
    },
  })
    .jpeg()
    .toBuffer();

describe('CU-14 Comprobantes', () => {
  it('PA-CU14-01 reduce una foto de 3000x4000 a PNG de 100x100 sin alfa', async () => {
    const procesado = await procesar(await jpegGrande());

    expect(procesado.mimeType).toBe('image/png');
    expect(procesado.ancho).toBe(100);
    expect(procesado.alto).toBe(100);
    expect(procesado.sha256).toMatch(/^[0-9a-f]{64}$/);

    const png = await leerPng(procesado.imagen);
    expect(png.ancho).toBe(100);
    expect(png.alto).toBe(100);
    expect(png.canales).toBe(3);
  });

  it('PA-CU14-02 aplana la transparencia sobre blanco', async () => {
    const transparente = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const procesado = await procesar(transparente);
    const png = await leerPng(procesado.imagen);
    const centro = pixel(png, 50, 50);

    expect(centro.r).toBeGreaterThan(250);
    expect(centro.g).toBeGreaterThan(250);
    expect(centro.b).toBeGreaterThan(250);
  });

  it('PA-CU14-03 ajusta una imagen panorámica sin recortar ni deformar', async () => {
    const panoramica = await sharp({
      create: {
        width: 200,
        height: 50,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    })
      .png()
      .toBuffer();

    const procesado = await procesar(panoramica);
    const png = await leerPng(procesado.imagen);

    const bandaSuperior = pixel(png, 50, 2);
    const centro = pixel(png, 50, 50);
    expect(bandaSuperior.r).toBeGreaterThan(250);
    expect(bandaSuperior.g).toBeGreaterThan(250);
    expect(bandaSuperior.b).toBeGreaterThan(250);
    expect(centro.b).toBeGreaterThan(200);
    expect(centro.r).toBeLessThan(50);
  });

  it('PA-CU14-04 respeta la orientación EXIF de una foto de celular', async () => {
    const ancho = 40;
    const alto = 20;
    const raw = Buffer.alloc(ancho * alto * 3);
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const i = (y * ancho + x) * 3;
        if (x < ancho / 2) {
          raw[i] = 255;
          raw[i + 1] = 0;
          raw[i + 2] = 0;
        } else {
          raw[i] = 0;
          raw[i + 1] = 0;
          raw[i + 2] = 255;
        }
      }
    }
    const jpeg = await sharp(raw, { raw: { width: ancho, height: alto, channels: 3 } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const procesado = await procesar(jpeg);
    const png = await leerPng(procesado.imagen);
    const arriba = pixel(png, 50, 10);
    const abajo = pixel(png, 50, 90);

    expect(arriba.r).toBeGreaterThan(200);
    expect(arriba.b).toBeLessThan(80);
    expect(abajo.b).toBeGreaterThan(200);
    expect(abajo.r).toBeLessThan(80);
  });

  it('PA-CU14-05 rechaza un archivo que no es una imagen real', async () => {
    const pdf = Buffer.from('%PDF-1.4\ncontenido falso');
    await expect(procesar(pdf)).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('PA-CU14-06 rechaza archivos de más de 5 MB', async () => {
    const grande = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
    await expect(
      procesarComprobante(grande, { decodificar: decodificarConSharp }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('PA-CU14-07 exige comprobante para métodos configurados', async () => {
    const persona = await personaConCargo();
    await expect(
      registrarPago(db, {
        personaId: persona.id,
        moneda: 'PEN',
        fechaPago: '2026-11-01',
        monto: '15.00',
        metodoPago: 'YAPE',
      }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect(await db.pagos.count()).toBe(0);
  });

  it('PA-CU14-08 advierte un comprobante duplicado por sha256', async () => {
    const persona = await personaConCargo();
    const procesado = await procesar(await jpegGrande());
    await registrarPago(db, {
      personaId: persona.id,
      moneda: 'PEN',
      fechaPago: '2026-11-01',
      monto: '15.00',
      metodoPago: 'EFECTIVO',
      comprobantes: [procesado],
    });

    await expect(
      registrarPago(db, {
        personaId: persona.id,
        moneda: 'PEN',
        fechaPago: '2026-11-02',
        monto: '1.00',
        metodoPago: 'EFECTIVO',
        comprobantes: [procesado],
      }),
    ).rejects.toBeInstanceOf(ErrorConflicto);

    await registrarPago(
      db,
      {
        personaId: persona.id,
        moneda: 'PEN',
        fechaPago: '2026-11-03',
        monto: '1.00',
        metodoPago: 'EFECTIVO',
        comprobantes: [procesado],
      },
      { confirmarDuplicado: true },
    );
    expect(await db.comprobantesPago.count()).toBe(2);
  });

  it('PA-CU14-09 rechaza un cuarto comprobante', async () => {
    const persona = await personaConCargo();
    const procesado: ComprobanteProcesado = await procesar(
      await jpegGrande(),
    );

    await expect(
      registrarPago(db, {
        personaId: persona.id,
        moneda: 'PEN',
        fechaPago: '2026-11-01',
        monto: '15.00',
        metodoPago: 'EFECTIVO',
        comprobantes: [procesado, procesado, procesado, procesado],
      }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect(await db.pagos.count()).toBe(0);
  });

  it('PA-CU14-10 el comprobante guardado se decodifica como PNG 100x100', async () => {
    const persona = await personaConCargo();
    const procesado = await procesar(await jpegGrande());
    const { pago } = await registrarPago(db, {
      personaId: persona.id,
      moneda: 'PEN',
      fechaPago: '2026-11-01',
      monto: '15.00',
      metodoPago: 'EFECTIVO',
      comprobantes: [procesado],
    });

    const guardados = await obtenerComprobantes(db, pago.id);
    expect(guardados).toHaveLength(1);
    const png = await leerPng(guardados[0]!.imagen);
    expect(png.ancho).toBe(100);
    expect(png.alto).toBe(100);
    expect(png.canales).toBe(3);
  });

  it('PA-CU14-11 el historial de pagos no incluye las imágenes', async () => {
    const persona = await personaConCargo();
    const procesado = await procesar(await jpegGrande());
    await registrarPago(db, {
      personaId: persona.id,
      moneda: 'PEN',
      fechaPago: '2026-11-01',
      monto: '15.00',
      metodoPago: 'EFECTIVO',
      comprobantes: [procesado],
    });

    const historial = await listarPagos(db);
    expect(historial).toHaveLength(1);
    const serializado = JSON.stringify(historial);
    expect(serializado).not.toContain('imagen');
    expect(serializado).not.toContain('base64');
    expect(serializado.length).toBeLessThan(2000);
  });
});
