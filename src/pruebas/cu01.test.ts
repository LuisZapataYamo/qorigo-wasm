import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import {
  ErrorDocumentoDuplicado,
  registrarPersona,
} from '../aplicacion/personas';
import { ErrorValidacion } from '../dominio/errores';
import { baseTemporal, destruirBase } from './util';
import { nombreCompleto } from '../dominio/nombres';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

describe('CU-01 Registrar persona', () => {
  it('PA-CU01-01 registra el alta mínima con nombre normalizado y auditoría', async () => {
    const resultado = await registrarPersona(db, {
      nombres: 'Kassandra',
      apellidos: 'Cisneros Zapata',
    });

    expect(resultado.estado).toBe('CREADA');
    expect(resultado.persona).not.toBeNull();
    expect(resultado.persona?.nombreNormalizado).toBe(
      'kassandra cisneros zapata',
    );
    expect(resultado.persona?.activo).toBe(true);

    const auditoria = await db.auditoria.toArray();
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({
      entidad: 'PERSONA',
      entidadId: resultado.persona?.id,
      accion: 'CREAR',
    });
  });

  it('PA-CU01-02 rechaza un documento duplicado y expone la persona existente', async () => {
    const primera = await registrarPersona(db, {
      nombres: 'Nayeli',
      apellidos: 'Zapata Yamo',
      documento: '12345678',
    });

    await expect(
      registrarPersona(db, {
        nombres: 'Otra',
        apellidos: 'Persona',
        documento: '12345678',
      }),
    ).rejects.toBeInstanceOf(ErrorDocumentoDuplicado);

    await expect(
      registrarPersona(db, {
        nombres: 'Otra',
        apellidos: 'Persona',
        documento: '12345678',
      }),
    ).rejects.toMatchObject({
      persona: { id: primera.persona?.id },
    });

    expect(await db.personas.count()).toBe(1);
  });

  it('PA-CU01-03 alerta por nombre similar y reutiliza la persona existente', async () => {
    const existente = await registrarPersona(db, {
      nombres: 'Nayeli',
      apellidos: 'Zapata Yamo',
    });

    const alerta = await registrarPersona(db, {
      nombres: 'nayelí',
      apellidos: 'zapata yamo',
    });

    expect(alerta.estado).toBe('REQUIERE_DECISION');
    expect(alerta.persona).toBeNull();
    expect(alerta.similares.map((p) => p.id)).toContain(
      existente.persona?.id,
    );

    const decision = await registrarPersona(
      db,
      { nombres: 'nayelí', apellidos: 'zapata yamo' },
      { resolucionSimilar: 'reutilizar' },
    );

    expect(decision.estado).toBe('REUTILIZADA');
    expect(decision.persona?.id).toBe(existente.persona?.id);
    expect(await db.personas.count()).toBe(1);
  });

  it('PA-CU01-04 permite crear de todos modos pese a la similitud', async () => {
    await registrarPersona(db, {
      nombres: 'Nayeli',
      apellidos: 'Zapata Yamo',
    });

    const creada = await registrarPersona(
      db,
      { nombres: 'nayelí', apellidos: 'zapata yamo' },
      { resolucionSimilar: 'crear' },
    );

    expect(creada.estado).toBe('CREADA');
    expect(await db.personas.count()).toBe(2);
    expect(nombreCompleto('nayelí', 'zapata yamo')).toBe(
      'nayelí zapata yamo',
    );
  });

  it('PA-CU01-05 exige apellidos y no guarda nada', async () => {
    await expect(
      registrarPersona(db, { nombres: 'Angelica', apellidos: '   ' }),
    ).rejects.toMatchObject({ campo: 'apellidos' });

    await expect(
      registrarPersona(db, { nombres: 'Angelica', apellidos: '   ' }),
    ).rejects.toBeInstanceOf(ErrorValidacion);

    expect(await db.personas.count()).toBe(0);
  });
});
