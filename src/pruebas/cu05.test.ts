import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../infraestructura/persistencia/baseDatos';
import {
  actualizarMiembro,
  agregarMiembro,
  darDeBajaMiembro,
} from '../aplicacion/miembros';
import { registrarPersona } from '../aplicacion/personas';
import { crearSuscripcion } from '../aplicacion/suscripciones';
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

async function contexto() {
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
  const alta = await registrarPersona(db, {
    nombres: 'Nayeli',
    apellidos: 'Zapata Yamo',
  });
  const agregado = await agregarMiembro(db, suscripcion.id, {
    personaId: alta.persona!.id,
    montoAcordado: '15.00',
    fechaInicio: '2026-01-01',
  });
  return { suscripcion, miembro: agregado.miembro };
}

describe('CU-05 Modificar monto o dar de baja', () => {
  it('PA-CU05-01 cambia el monto sin alterar el cargo ya generado', async () => {
    const { miembro } = await contexto();
    const cargoId = nuevoId();
    await db.cargosSuscripcion.add({
      id: cargoId,
      miembroId: miembro.id,
      periodo: '2026-11-01',
      montoCentimos: 1500,
      fechaVencimiento: '2026-11-05',
      estado: 'PENDIENTE',
    });

    const actualizado = await actualizarMiembro(db, miembro.id, {
      montoAcordado: '16.00',
    });

    expect(actualizado.montoAcordadoCentimos).toBe(1600);
    expect((await db.cargosSuscripcion.get(cargoId))?.montoCentimos).toBe(
      1500,
    );

    const auditoria = await db.auditoria
      .where('entidadId')
      .equals(miembro.id)
      .toArray();
    const cambio = auditoria.find((a) => a.accion === 'ACTUALIZAR');
    expect((cambio?.antes as { montoAcordadoCentimos: number }).montoAcordadoCentimos).toBe(1500);
    expect((cambio?.despues as { montoAcordadoCentimos: number }).montoAcordadoCentimos).toBe(1600);
  });

  it('PA-CU05-02 da de baja sin borrar los cargos pendientes', async () => {
    const { miembro } = await contexto();
    const cargoId = nuevoId();
    await db.cargosSuscripcion.add({
      id: cargoId,
      miembroId: miembro.id,
      periodo: '2026-11-01',
      montoCentimos: 1500,
      fechaVencimiento: '2026-11-05',
      estado: 'PENDIENTE',
    });

    const baja = await darDeBajaMiembro(db, miembro.id, '2026-11-30');

    expect(baja.estado).toBe('INACTIVO');
    expect(baja.fechaFin).toBe('2026-11-30');
    expect(await db.cargosSuscripcion.count()).toBe(1);
    expect((await db.cargosSuscripcion.get(cargoId))?.estado).toBe(
      'PENDIENTE',
    );
  });

  it('PA-CU05-03 rechaza un monto negativo', async () => {
    const { miembro } = await contexto();
    await expect(
      actualizarMiembro(db, miembro.id, { montoAcordado: '-1' }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect((await db.miembrosSuscripcion.get(miembro.id))?.montoAcordadoCentimos).toBe(
      1500,
    );
  });

  it('rechaza una fecha de baja anterior al inicio', async () => {
    const { miembro } = await contexto();
    await expect(
      darDeBajaMiembro(db, miembro.id, '2025-12-31'),
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });
});
