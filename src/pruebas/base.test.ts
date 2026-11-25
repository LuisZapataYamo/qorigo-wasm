import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

describe('base local', () => {
  it('siembra monedas, plataformas y configuración una sola vez', async () => {
    expect(await db.monedas.count()).toBe(3);
    expect(await db.plataformas.count()).toBe(3);
    expect((await db.configuracion.get('umbral_riesgo_dias'))?.valor).toBe(
      '30',
    );

    const { asegurarSemilla } = await import('../db/semilla');
    await asegurarSemilla(db);

    expect(await db.monedas.count()).toBe(3);
    expect(await db.plataformas.count()).toBe(3);
  });

  it('guarda importes como enteros de céntimos', async () => {
    const { aCentimos } = await import('../dominio/dinero');
    expect(aCentimos('53.90')).toBe(5390);
    expect(aCentimos(15)).toBe(1500);
  });
});
