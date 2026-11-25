import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import {
  desactivarPersona,
  editarPersona,
  eliminarPersona,
  listarPersonas,
  registrarPersona,
} from '../aplicacion/personas';
import { ErrorReglaNegocio } from '../dominio/errores';
import { nuevoId } from '../dominio/ids';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

describe('CU-02 Consultar y editar persona', () => {
  it('PA-CU02-01 encuentra personas sin exigir tildes', async () => {
    await registrarPersona(db, {
      nombres: 'Angélica',
      apellidos: 'Zapata Yamo',
    });
    await registrarPersona(db, {
      nombres: 'Nayeli',
      apellidos: 'Zapata Yamo',
    });

    const resultado = await listarPersonas(db, { busqueda: 'angelíca' });

    expect(resultado.total).toBe(1);
    expect(resultado.items[0]?.nombres).toBe('Angélica');
  });

  it('PA-CU02-02 no elimina una persona con movimientos y permite desactivarla', async () => {
    const alta = await registrarPersona(db, {
      nombres: 'Nayeli',
      apellidos: 'Zapata Yamo',
    });
    const persona = alta.persona!;
    const plataforma = await db.plataformas.toCollection().first();
    const suscripcionId = nuevoId();
    await db.suscripciones.add({
      id: suscripcionId,
      plataformaId: plataforma!.id,
      nombre: 'YouTube',
      moneda: 'PEN',
      costoCentimos: 5390,
      periodicidad: 'MENSUAL',
      capacidad: 6,
      diaCobro: 1,
      fechaInicio: '2026-01-01',
      estado: 'ACTIVA',
      esUsoPersonal: false,
      creadoEn: new Date().toISOString(),
    });
    await db.miembrosSuscripcion.add({
      id: nuevoId(),
      suscripcionId,
      personaId: persona.id,
      montoAcordadoCentimos: 1500,
      esPlazaPropia: false,
      fechaInicio: '2026-01-01',
      estado: 'ACTIVO',
    });

    await expect(eliminarPersona(db, persona.id)).rejects.toBeInstanceOf(
      ErrorReglaNegocio,
    );

    const desactivada = await desactivarPersona(db, persona.id);

    expect(desactivada.activo).toBe(false);
    expect(await db.personas.count()).toBe(1);
    expect(await db.miembrosSuscripcion.count()).toBe(1);
    const auditoria = await db.auditoria
      .where('entidadId')
      .equals(persona.id)
      .toArray();
    expect(auditoria.some((a) => a.accion === 'DESACTIVAR')).toBe(true);
  });

  it('PA-CU02-03 edita y audita el valor anterior y el nuevo', async () => {
    const alta = await registrarPersona(db, {
      nombres: 'Ernesto',
      apellidos: 'Quispe',
      telefono: '999111222',
    });
    const persona = alta.persona!;

    const actualizada = await editarPersona(db, persona.id, {
      telefono: '988777666',
    });

    expect(actualizada.telefono).toBe('988777666');

    const auditoria = await db.auditoria
      .where('entidadId')
      .equals(persona.id)
      .toArray();
    const cambio = auditoria.find((a) => a.accion === 'ACTUALIZAR');
    expect(cambio).toBeDefined();
    expect((cambio?.antes as { telefono?: string }).telefono).toBe('999111222');
    expect((cambio?.despues as { telefono?: string }).telefono).toBe(
      '988777666',
    );
  });

  it('filtra por estado y pagina los resultados', async () => {
    const nombres = ['Ana', 'Beto', 'Carla'];
    const apellidos = ['Alvarez', 'Benitez', 'Castillo'];
    for (let i = 0; i < 3; i++) {
      await registrarPersona(db, {
        nombres: nombres[i],
        apellidos: apellidos[i],
      });
    }
    const primera = await listarPersonas(db, { pagina: 1, tamano: 2 });
    expect(primera.items).toHaveLength(2);
    expect(primera.paginas).toBe(2);

    const todas = await listarPersonas(db, { estado: 'ACTIVAS' });
    expect(todas.total).toBe(3);
  });
});
