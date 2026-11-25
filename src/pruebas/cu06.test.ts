import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import { agregarMiembro, darDeBajaMiembro } from '../aplicacion/miembros';
import { registrarPersona } from '../aplicacion/personas';
import { crearSuscripcion } from '../aplicacion/suscripciones';
import { generarPeriodo } from '../aplicacion/cargos';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function nuevaPersona(nombres: string, apellidos: string) {
  const alta = await registrarPersona(
    db,
    { nombres, apellidos },
    { resolucionSimilar: 'crear' },
  );
  return alta.persona!;
}

async function crearYoutube() {
  const plataforma = await db.plataformas
    .filter((p) => p.nombre === 'YouTube')
    .first();
  return crearSuscripcion(db, {
    plataformaId: plataforma!.id,
    nombre: 'YouTube Premium',
    moneda: 'PEN',
    costo: '53.90',
    capacidad: 6,
    diaCobro: 5,
    fechaInicio: '2026-01-01',
  });
}

async function conTresMiembros(suscripcionId: string) {
  const personas = [
    await nuevaPersona('Nayeli', 'Zapata Yamo'),
    await nuevaPersona('Ernesto', 'Quispe Huaman'),
    await nuevaPersona('Angelica', 'Zapata Yamo'),
  ];
  const montos = ['15.00', '15.00', '14.00'];
  for (let i = 0; i < 3; i++) {
    await agregarMiembro(db, suscripcionId, {
      personaId: personas[i].id,
      montoAcordado: montos[i],
      fechaInicio: '2026-01-01',
    });
  }
}

describe('CU-06 Generar cargos y costos del periodo', () => {
  it('PA-CU06-01 genera tres cargos y un costo para noviembre', async () => {
    const suscripcion = await crearYoutube();
    await conTresMiembros(suscripcion.id);

    const resultado = await generarPeriodo(db, '2026-11-01');

    expect(resultado.cargosCreados).toBe(3);
    expect(resultado.costosCreados).toBe(1);
    expect(resultado.errores).toHaveLength(0);

    const cargos = await db.cargosSuscripcion
      .where('periodo')
      .equals('2026-11-01')
      .toArray();
    expect(cargos.map((c) => c.montoCentimos).sort((a, b) => a - b)).toEqual([
      1400, 1500, 1500,
    ]);
    expect(cargos.every((c) => c.fechaVencimiento === '2026-11-05')).toBe(true);

    const costos = await db.costosSuscripcionPeriodo.toArray();
    expect(costos).toHaveLength(1);
    expect(costos[0]?.montoCentimos).toBe(5390);
  });

  it('PA-CU06-02 es idempotente al ejecutarse dos veces', async () => {
    const suscripcion = await crearYoutube();
    await conTresMiembros(suscripcion.id);

    await generarPeriodo(db, '2026-11-01');
    const segunda = await generarPeriodo(db, '2026-11-01');

    expect(segunda.cargosCreados).toBe(0);
    expect(segunda.costosCreados).toBe(0);
    expect(await db.cargosSuscripcion.count()).toBe(3);
    expect(await db.costosSuscripcionPeriodo.count()).toBe(1);
  });

  it('PA-CU06-03 la plaza propia genera costo pero ningún cargo', async () => {
    const plataforma = await db.plataformas
      .filter((p) => p.nombre === 'Obsidian')
      .first();
    const suscripcion = await crearSuscripcion(db, {
      plataformaId: plataforma!.id,
      nombre: 'Obsidian',
      moneda: 'PEN',
      costo: '18.00',
      capacidad: 1,
      diaCobro: 1,
      fechaInicio: '2026-01-01',
    });
    const persona = await nuevaPersona('Luis', 'Zapata Yamo');
    await agregarMiembro(db, suscripcion.id, {
      personaId: persona.id,
      montoAcordado: '0',
      esPlazaPropia: true,
      fechaInicio: '2026-01-01',
    });

    const resultado = await generarPeriodo(db, '2026-11-01');

    expect(resultado.costosCreados).toBe(1);
    expect(resultado.cargosCreados).toBe(0);
    expect((await db.costosSuscripcionPeriodo.toArray())[0]?.montoCentimos).toBe(
      1800,
    );
  });

  it('PA-CU06-04 un fallo en una suscripción no impide procesar las demás', async () => {
    const youtube = await crearYoutube();
    const obsidianPlataforma = await db.plataformas
      .filter((p) => p.nombre === 'Obsidian')
      .first();
    const obsidian = await crearSuscripcion(db, {
      plataformaId: obsidianPlataforma!.id,
      nombre: 'Obsidian',
      moneda: 'PEN',
      costo: '18.00',
      capacidad: 1,
      diaCobro: 1,
      fechaInicio: '2026-01-01',
    });
    await conTresMiembros(youtube.id);

    const resultado = await generarPeriodo(db, '2026-11-01', {
      alProcesarSuscripcion: (suscripcion) => {
        if (suscripcion.id === youtube.id) {
          throw new Error('Fallo simulado');
        }
      },
    });

    expect(resultado.errores).toHaveLength(1);
    expect(resultado.errores[0]?.suscripcionId).toBe(youtube.id);
    expect(resultado.procesadas).toBe(1);
    expect(resultado.costosCreados).toBe(1);
    expect(await db.cargosSuscripcion.count()).toBe(0);
    const auditoria = await db.auditoria
      .where('entidadId')
      .equals(youtube.id)
      .toArray();
    expect(auditoria.some((a) => a.accion === 'ERROR_GENERACION')).toBe(true);

    const costoObsidian = await db.costosSuscripcionPeriodo
      .where('suscripcionId')
      .equals(obsidian.id)
      .toArray();
    expect(costoObsidian).toHaveLength(1);
  });

  it('PA-CU06-05 un miembro nuevo en un mes ya generado crea solo su cargo', async () => {
    const suscripcion = await crearYoutube();
    await conTresMiembros(suscripcion.id);
    await generarPeriodo(db, '2026-11-01');

    const nueva = await nuevaPersona('Kassandra', 'Cisneros Zapata');
    await agregarMiembro(db, suscripcion.id, {
      personaId: nueva.id,
      montoAcordado: '12.00',
      fechaInicio: '2026-11-15',
    });

    const resultado = await generarPeriodo(db, '2026-11-01');

    expect(resultado.cargosCreados).toBe(1);
    expect(await db.cargosSuscripcion.count()).toBe(4);
  });

  it('PA-CU06-06 no genera cargo para un miembro dado de baja antes del periodo', async () => {
    const suscripcion = await crearYoutube();
    const persona = await nuevaPersona('Ernesto', 'Quispe Huaman');
    const agregado = await agregarMiembro(db, suscripcion.id, {
      personaId: persona.id,
      montoAcordado: '15.00',
      fechaInicio: '2026-01-01',
    });
    await darDeBajaMiembro(db, agregado.miembro.id, '2026-10-31');

    const resultado = await generarPeriodo(db, '2026-11-01');

    expect(resultado.cargosCreados).toBe(0);
    expect(await db.cargosSuscripcion.count()).toBe(0);
    expect(resultado.costosCreados).toBe(1);
  });
});
