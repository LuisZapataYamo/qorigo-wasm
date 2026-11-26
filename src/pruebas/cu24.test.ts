import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseDatos, crearBaseDeDatos } from '../infraestructura/persistencia/baseDatos';
import { registrarPersona } from '../aplicacion/personas';
import {
  estimarAlmacenamiento,
  formatearBytes,
  persistenciaDisponible,
  solicitarPersistencia,
} from '../infraestructura/navegador/almacenamiento';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

describe('CU-24 Uso de la PWA sin conexión', () => {
  it('PA-CU24-01 declara la instalación y los iconos requeridos', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain('VitePWA');
    expect(config).toContain("display: 'standalone'");
    expect(config).toContain('icono-192.png');
    expect(config).toContain('icono-512.png');
    expect(config).toContain('registerType');

    const icono192 = readFileSync('public/icono-192.png');
    const icono512 = readFileSync('public/icono-512.png');
    const firma = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    expect([...icono192.subarray(0, 8)]).toEqual(firma);
    expect([...icono512.subarray(0, 8)]).toEqual(firma);
    expect(icono192.readUInt32BE(16)).toBe(192);
    expect(icono192.readUInt32BE(20)).toBe(192);
    expect(icono512.readUInt32BE(16)).toBe(512);
    expect(icono512.readUInt32BE(20)).toBe(512);
  });

  it('PA-CU24-02/03 la interfaz se precarga y la base vive en IndexedDB', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain('globPatterns');
    expect(config).toContain('navigateFallback');
    expect(config).toContain('workbox');
    expect(readFileSync('index.html', 'utf8')).toContain('id="root"');
  });

  it('PA-CU24-04 los datos sobreviven al cerrar y reabrir la base', async () => {
    const alta = await registrarPersona(db, {
      nombres: 'Ana',
      apellidos: 'Alvarez',
    });
    const nombre = db.name;
    db.close();

    const reabierta = new BaseDatos(nombre);
    const persona = await reabierta.personas.get(alta.persona!.id);
    expect(persona?.nombres).toBe('Ana');
    reabierta.close();
  });

  it('PA-CU24-05 dos instalaciones no comparten datos automáticamente', async () => {
    const otra = crearBaseDeDatos(`${db.name}-otra`);
    await registrarPersona(db, { nombres: 'Ana', apellidos: 'Alvarez' });

    expect(await db.personas.count()).toBe(1);
    expect(await otra.personas.count()).toBe(0);
    otra.close();
  });

  it('PA-CU24-06 informa cuando el navegador no ofrece persistencia', async () => {
    expect(persistenciaDisponible()).toBe(false);
    expect(await solicitarPersistencia()).toBe(false);
    expect(await estimarAlmacenamiento()).toBeNull();
  });

  it('formatea el uso de almacenamiento para la interfaz', () => {
    expect(formatearBytes(0)).toBe('0 B');
    expect(formatearBytes(1024)).toBe('1 KB');
    expect(formatearBytes(1536)).toBe('1.5 KB');
    expect(formatearBytes(5 * 1024 * 1024)).toBe('5 MB');
  });
});
