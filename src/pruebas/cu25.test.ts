import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { BaseDatos } from '../db/baseDatos';
import {
  ADVERTENCIA_EXPORTACION,
  exportarDatos,
  nombreArchivoExportacion,
  serializarPaquete,
} from '../aplicacion/respaldo';
import { procesarComprobante } from '../aplicacion/comprobantes';
import { generarPeriodo } from '../aplicacion/cargos';
import { agregarMiembro } from '../aplicacion/miembros';
import {
  obtenerObligacionesPendientes,
  registrarPago,
} from '../aplicacion/pagos';
import { registrarPersona } from '../aplicacion/personas';
import { crearPrestamo } from '../aplicacion/prestamos';
import { configurarAcceso } from '../aplicacion/sesion';
import { crearSuscripcion } from '../aplicacion/suscripciones';
import { baseTemporal, destruirBase } from './util';
import { decodificarConSharp, leerPng } from './imagen';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function escenario() {
  const persona = (
    await registrarPersona(
      db,
      { nombres: 'Ana', apellidos: 'Alvarez' },
      { resolucionSimilar: 'crear' },
    )
  ).persona!;
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
  await agregarMiembro(db, suscripcion.id, {
    personaId: persona.id,
    montoAcordado: '15.00',
    fechaInicio: '2026-01-01',
  });
  await generarPeriodo(db, '2026-11-01');

  await crearPrestamo(db, {
    personaId: persona.id,
    moneda: 'PEN',
    capital: '1000.00',
    tasaMensual: 5,
    plazoMeses: 2,
    fechaPrestamo: '2026-11-01',
    estrictoCumplimiento: false,
  });

  const jpeg = await sharp({
    create: {
      width: 120,
      height: 120,
      channels: 3,
      background: { r: 10, g: 120, b: 200 },
    },
  })
    .jpeg()
    .toBuffer();
  const comprobante = await procesarComprobante(
    new Blob([new Uint8Array(jpeg)]),
    { decodificar: decodificarConSharp },
  );

  const cargo = (
    await obtenerObligacionesPendientes(db, persona.id, 'SUSCRIPCION')
  )[0]!;
  await registrarPago(db, {
    personaId: persona.id,
    moneda: 'PEN',
    fechaPago: '2026-11-10',
    monto: '15.00',
    metodoPago: 'EFECTIVO',
    comprobantes: [comprobante],
    aplicaciones: [
      { tipo: 'SUSCRIPCION', obligacionId: cargo.id, monto: '15.00' },
    ],
  });

  await configurarAcceso(db, {
    personaId: persona.id,
    email: 'ana@example.com',
    password: 'ClaveSegura123',
  });

  return { persona, comprobante };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('CU-25 Exportar datos', () => {
  it('PA-CU25-01 exporta las entidades con UUID y referencias', async () => {
    await escenario();
    const paquete = await exportarDatos(db);

    expect(paquete.data.personas).toHaveLength(1);
    expect(paquete.data.suscripciones).toHaveLength(1);
    expect(paquete.data.miembrosSuscripcion).toHaveLength(1);
    expect(paquete.data.cargosSuscripcion).toHaveLength(1);
    expect(paquete.data.prestamos).toHaveLength(1);
    expect(paquete.data.cuotasPrestamo).toHaveLength(2);
    expect(paquete.data.pagos).toHaveLength(1);
    expect(paquete.data.aplicacionesPago).toHaveLength(1);
    expect(paquete.data.comprobantes).toHaveLength(1);

    expect(paquete.data.personas[0]?.id).toMatch(UUID);
    expect(paquete.data.aplicacionesPago[0]?.pagoId).toBe(
      paquete.data.pagos[0]?.id,
    );
    expect(paquete.data.comprobantes[0]?.pagoId).toBe(
      paquete.data.pagos[0]?.id,
    );
    expect(JSON.parse(serializarPaquete(paquete)).format).toBe('qorigo-data');
  });

  it('PA-CU25-02 incluye metadatos de formato y versión', async () => {
    await escenario();
    const paquete = await exportarDatos(db);

    expect(paquete.format).toBe('qorigo-data');
    expect(paquete.formatVersion).toBe(1);
    expect(paquete.schemaVersion).toBe(1);
    expect(paquete.appVersion).toBe('1.0.0');
    expect(Number.isNaN(Date.parse(paquete.exportedAt))).toBe(false);
    expect(paquete.timezone).toBe('America/Lima');
    expect(paquete.currencies).toContain('PEN');
    expect(nombreArchivoExportacion().endsWith('.json')).toBe(true);
  });

  it('PA-CU25-03 incluye los comprobantes como base64 válido', async () => {
    await escenario();
    const paquete = await exportarDatos(db);
    const comprobante = paquete.data.comprobantes[0]!;

    expect(comprobante.mimeType).toBe('image/png');
    expect(comprobante.imagenBase64).not.toContain('data:');
    const bytes = Buffer.from(comprobante.imagenBase64, 'base64');
    expect(bytes.length).toBeGreaterThan(0);
    const png = await leerPng(new Blob([new Uint8Array(bytes)]));
    expect(png.ancho).toBe(100);
    expect(png.alto).toBe(100);
  });

  it('PA-CU25-04 advierte sobre la privacidad del archivo', () => {
    expect(ADVERTENCIA_EXPORTACION.length).toBeGreaterThan(40);
    expect(ADVERTENCIA_EXPORTACION.toLowerCase()).toContain('seguro');
  });

  it('PA-CU25-05 exportar no modifica los datos locales', async () => {
    await escenario();
    const antes = {
      personas: await db.personas.count(),
      pagos: await db.pagos.count(),
      comprobantes: await db.comprobantesPago.count(),
    };
    const primera = await exportarDatos(db);
    const segunda = await exportarDatos(db);

    expect(JSON.stringify(primera.data)).toBe(JSON.stringify(segunda.data));
    expect(await db.personas.count()).toBe(antes.personas);
    expect(await db.pagos.count()).toBe(antes.pagos);
    expect(await db.comprobantesPago.count()).toBe(antes.comprobantes);
  });

  it('PA-CU25-06 informa el error si la base no está disponible', async () => {
    db.close();
    await expect(exportarDatos(db)).rejects.toBeTruthy();
  });

  it('no exporta credenciales ni la marca de acceso local', async () => {
    await escenario();
    const serializado = JSON.stringify(await exportarDatos(db));

    expect(serializado).not.toContain('passwordHash');
    expect(serializado).not.toContain('pbkdf2$');
    expect(serializado).not.toContain('ana@example.com');
    expect(serializado).not.toContain('acceso_configurado');
  });
});
