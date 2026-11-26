import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../infraestructura/persistencia/baseDatos';
import {
  actualizarSuscripcion,
  costoVigentePara,
  crearSuscripcion,
  detalleSuscripcion,
} from '../aplicacion/suscripciones';
import { ErrorValidacion } from '../dominio/errores';
import { nuevoId } from '../dominio/ids';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function plataformaYouTube(): Promise<string> {
  const plataforma = await db.plataformas
    .filter((p) => p.nombre === 'YouTube')
    .first();
  return plataforma!.id;
}

async function crearYouTube(costo: number | string = '53.90') {
  return crearSuscripcion(db, {
    plataformaId: await plataformaYouTube(),
    nombre: 'YouTube Premium',
    moneda: 'PEN',
    costo,
    capacidad: 6,
    diaCobro: 5,
    fechaInicio: '2026-01-01',
  });
}

describe('CU-03 Crear suscripción', () => {
  it('PA-CU03-01 crea la suscripción con plazas, costo por plaza y cobertura cero', async () => {
    const suscripcion = await crearYouTube();

    const detalle = await detalleSuscripcion(db, suscripcion.id, '2026-11-01');

    expect(detalle.suscripcion.estado).toBe('ACTIVA');
    expect(detalle.plazasLibres).toBe(6);
    expect(detalle.plazasOcupadas).toBe(0);
    expect(detalle.costoPorPlazaCentimos).toBe(898);
    expect(detalle.coberturaCentimos).toBe(0);
    expect(detalle.enDeficit).toBe(false);
    expect(await db.auditoria.count()).toBe(1);
  });

  it('PA-CU03-02 rechaza un costo cero o negativo', async () => {
    await expect(crearYouTube(0)).rejects.toBeInstanceOf(ErrorValidacion);
    await expect(crearYouTube(-10)).rejects.toBeInstanceOf(ErrorValidacion);
    expect(await db.suscripciones.count()).toBe(0);
  });

  it('PA-CU03-03 rechaza capacidad cero', async () => {
    const plataformaId = await plataformaYouTube();
    await expect(
      crearSuscripcion(db, {
        plataformaId,
        nombre: 'Sin plazas',
        moneda: 'PEN',
        costo: '20.00',
        capacidad: 0,
        diaCobro: 1,
        fechaInicio: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect(await db.suscripciones.count()).toBe(0);
  });

  it('PA-CU03-04 el costo generado de noviembre no cambia; el nuevo rige desde diciembre', async () => {
    const suscripcion = await crearYouTube();
    await db.costosSuscripcionPeriodo.add({
      id: nuevoId(),
      suscripcionId: suscripcion.id,
      periodo: '2026-11-01',
      montoCentimos: 5390,
    });

    await actualizarSuscripcion(db, suscripcion.id, { costo: '57.90' });

    expect(
      await costoVigentePara(db, suscripcion.id, '2026-11-01'),
    ).toBe(5390);
    expect(
      await costoVigentePara(db, suscripcion.id, '2026-12-01'),
    ).toBe(5790);

    const historico = await db.costosSuscripcionPeriodo
      .where('suscripcionId')
      .equals(suscripcion.id)
      .toArray();
    expect(historico).toHaveLength(1);
    expect(historico[0]?.montoCentimos).toBe(5390);
    expect((await db.suscripciones.get(suscripcion.id))?.costoCentimos).toBe(
      5790,
    );
  });

  it('PA-CU03-05 suspende la suscripción y lo audita', async () => {
    const suscripcion = await crearYouTube();

    const actualizada = await actualizarSuscripcion(db, suscripcion.id, {
      estado: 'SUSPENDIDA',
    });

    expect(actualizada.estado).toBe('SUSPENDIDA');
    const auditoria = await db.auditoria
      .where('entidadId')
      .equals(suscripcion.id)
      .toArray();
    expect(auditoria.some((a) => a.accion === 'ACTUALIZAR')).toBe(true);
  });
});
