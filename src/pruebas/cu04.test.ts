import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../infraestructura/persistencia/baseDatos';
import {
  agregarMiembro,
  agregarMiembroConPersonaNueva,
  listarMiembros,
} from '../aplicacion/miembros';
import { registrarPersona } from '../aplicacion/personas';
import { crearSuscripcion, detalleSuscripcion } from '../aplicacion/suscripciones';
import { ErrorValidacion } from '../dominio/errores';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function plataforma(nombre: string): Promise<string> {
  const encontrada = await db.plataformas
    .filter((p) => p.nombre === nombre)
    .first();
  return encontrada!.id;
}

async function nuevaPersona(nombres: string, apellidos: string) {
  const alta = await registrarPersona(
    db,
    { nombres, apellidos },
    { resolucionSimilar: 'crear' },
  );
  return alta.persona!;
}

async function youtube(costo = '53.90', capacidad = 6) {
  return crearSuscripcion(db, {
    plataformaId: await plataforma('YouTube'),
    nombre: 'YouTube Premium',
    moneda: 'PEN',
    costo,
    capacidad,
    diaCobro: 5,
    fechaInicio: '2026-01-01',
  });
}

describe('CU-04 Agregar miembro a una suscripción', () => {
  it('PA-CU04-01 agrega un miembro existente y recalcula plazas y cobertura', async () => {
    const suscripcion = await youtube();
    const nayeli = await nuevaPersona('Nayeli', 'Zapata Yamo');

    const resultado = await agregarMiembro(db, suscripcion.id, {
      personaId: nayeli.id,
      montoAcordado: '15.00',
      fechaInicio: '2026-01-01',
    });

    expect(resultado.miembro.estado).toBe('ACTIVO');
    expect(resultado.coberturaCentimos).toBe(-3890);

    const detalle = await detalleSuscripcion(db, suscripcion.id);
    expect(detalle.plazasLibres).toBe(5);
    expect(detalle.coberturaCentimos).toBe(-3890);
    expect(detalle.miembros).toHaveLength(1);
  });

  it('PA-CU04-02 crea la persona desde el alta del miembro', async () => {
    const suscripcion = await youtube();

    const resultado = await agregarMiembroConPersonaNueva(
      db,
      suscripcion.id,
      {
        nombres: 'Kassandra',
        apellidos: 'Cisneros Zapata',
      },
      {
        montoAcordado: '15.00',
        fechaInicio: '2026-01-01',
      },
    );

    expect(resultado.estado).toBe('AGREGADO');
    expect(resultado.agregado?.persona.nombres).toBe('Kassandra');
    expect(await db.personas.count()).toBe(1);
    expect(await db.miembrosSuscripcion.count()).toBe(1);
  });

  it('PA-CU04-03 rechaza el alta cuando no hay plazas libres', async () => {
    const suscripcion = await crearSuscripcion(db, {
      plataformaId: await plataforma('Obsidian'),
      nombre: 'Obsidian',
      moneda: 'PEN',
      costo: '18.00',
      capacidad: 1,
      diaCobro: 1,
      fechaInicio: '2026-01-01',
    });
    const primera = await nuevaPersona('Ana', 'Alvarez');
    const segunda = await nuevaPersona('Beto', 'Benitez');

    await agregarMiembro(db, suscripcion.id, {
      personaId: primera.id,
      montoAcordado: '18.00',
      fechaInicio: '2026-01-01',
    });

    await expect(
      agregarMiembro(db, suscripcion.id, {
        personaId: segunda.id,
        montoAcordado: '18.00',
        fechaInicio: '2026-01-01',
      }),
    ).rejects.toThrow(/plazas libres/i);
  });

  it('PA-CU04-04 rechaza una segunda membresía activa de la misma persona', async () => {
    const suscripcion = await youtube();
    const persona = await nuevaPersona('Nayeli', 'Zapata Yamo');
    await agregarMiembro(db, suscripcion.id, {
      personaId: persona.id,
      montoAcordado: '15.00',
      fechaInicio: '2026-01-01',
    });

    await expect(
      agregarMiembro(db, suscripcion.id, {
        personaId: persona.id,
        montoAcordado: '15.00',
        fechaInicio: '2026-02-01',
      }),
    ).rejects.toThrow(/membresía activa/i);
  });

  it('PA-CU04-05 la plaza propia queda en monto cero y no genera cargos', async () => {
    const suscripcion = await youtube();
    const persona = await nuevaPersona('Luis', 'Zapata Yamo');

    const resultado = await agregarMiembro(db, suscripcion.id, {
      personaId: persona.id,
      montoAcordado: '0',
      esPlazaPropia: true,
      fechaInicio: '2026-01-01',
    });

    expect(resultado.miembro.esPlazaPropia).toBe(true);
    expect(resultado.miembro.montoAcordadoCentimos).toBe(0);
    expect(await db.cargosSuscripcion.count()).toBe(0);
  });

  it('PA-CU04-06 rechaza una plaza propia con monto distinto de cero', async () => {
    const suscripcion = await youtube();
    const persona = await nuevaPersona('Luis', 'Zapata Yamo');

    await expect(
      agregarMiembro(db, suscripcion.id, {
        personaId: persona.id,
        montoAcordado: '5',
        esPlazaPropia: true,
        fechaInicio: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('PA-CU04-07 muestra déficit con los tres miembros reales', async () => {
    const suscripcion = await youtube();
    const personas = [
      await nuevaPersona('Nayeli', 'Zapata Yamo'),
      await nuevaPersona('Ernesto', 'Quispe Huaman'),
      await nuevaPersona('Angelica', 'Zapata Yamo'),
    ];
    const montos = ['15.00', '15.00', '14.00'];

    for (let i = 0; i < personas.length; i++) {
      await agregarMiembro(db, suscripcion.id, {
        personaId: personas[i].id,
        montoAcordado: montos[i],
        fechaInicio: '2026-01-01',
      });
    }

    const detalle = await detalleSuscripcion(db, suscripcion.id);
    expect(detalle.coberturaCentimos).toBe(-990);
    expect(detalle.enDeficit).toBe(true);
    expect(detalle.plazasLibres).toBe(3);
  });

  it('PA-CU04-08 un plan de 30 con una plaza de 10 y cuatro de 5 no tiene déficit', async () => {
    const suscripcion = await youtube('30.00', 5);
    const personas = [
      await nuevaPersona('Ana', 'Alvarez'),
      await nuevaPersona('Beto', 'Benitez'),
      await nuevaPersona('Carla', 'Castillo'),
      await nuevaPersona('Diego', 'Diaz'),
      await nuevaPersona('Elena', 'Espinoza'),
    ];
    await agregarMiembro(db, suscripcion.id, {
      personaId: personas[0].id,
      montoAcordado: '10.00',
      fechaInicio: '2026-01-01',
    });
    for (let i = 1; i < 5; i++) {
      await agregarMiembro(db, suscripcion.id, {
        personaId: personas[i].id,
        montoAcordado: '5.00',
        fechaInicio: '2026-01-01',
      });
    }

    const detalle = await detalleSuscripcion(db, suscripcion.id);
    expect(detalle.coberturaCentimos).toBe(0);
    expect(detalle.enDeficit).toBe(false);
  });

  it('PA-CU04-09 con una sola plaza, dos altas simultáneas dejan solo una', async () => {
    const suscripcion = await youtube('30.00', 1);
    const primera = await nuevaPersona('Ana', 'Alvarez');
    const segunda = await nuevaPersona('Beto', 'Benitez');

    const resultados = await Promise.allSettled([
      agregarMiembro(db, suscripcion.id, {
        personaId: primera.id,
        montoAcordado: '15.00',
        fechaInicio: '2026-01-01',
      }),
      agregarMiembro(db, suscripcion.id, {
        personaId: segunda.id,
        montoAcordado: '15.00',
        fechaInicio: '2026-01-01',
      }),
    ]);

    const aceptadas = resultados.filter((r) => r.status === 'fulfilled');
    const rechazadas = resultados.filter((r) => r.status === 'rejected');
    expect(aceptadas).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(await db.miembrosSuscripcion.count()).toBe(1);
    expect(await listarMiembros(db, suscripcion.id)).toHaveLength(1);
  });
});
