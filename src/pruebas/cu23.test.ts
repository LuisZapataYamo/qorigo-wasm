import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../infraestructura/persistencia/baseDatos';
import {
  cerrarSesion,
  configurarAcceso,
  crearAccesoPersona,
  iniciarSesion,
  recuperarAcceso,
  sesionActual,
} from '../aplicacion/sesion';
import { registrarPersona } from '../aplicacion/personas';
import { ErrorReglaNegocio, ErrorValidacion } from '../dominio/errores';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function persona(nombres: string, apellidos: string) {
  const alta = await registrarPersona(
    db,
    { nombres, apellidos },
    { resolucionSimilar: 'crear' },
  );
  return alta.persona!;
}

describe('CU-23 Acceso local', () => {
  it('PA-CU23-01 inicia sesión con credenciales válidas', async () => {
    const titular = await persona('Ana', 'Alvarez');
    const usuario = await configurarAcceso(db, {
      personaId: titular.id,
      email: 'ana@example.com',
      password: 'ClaveSegura123',
    });
    expect(usuario.rol).toBe('ADMIN');
    expect((await sesionActual(db))?.id).toBe(usuario.id);

    await cerrarSesion(db);
    expect(await sesionActual(db)).toBeNull();

    const sesion = await iniciarSesion(
      db,
      'ana@example.com',
      'ClaveSegura123',
    );
    expect(sesion.id).toBe(usuario.id);
    expect((await sesionActual(db))?.id).toBe(usuario.id);
  });

  it('PA-CU23-02 no revela si el correo existe', async () => {
    const titular = await persona('Ana', 'Alvarez');
    await configurarAcceso(db, {
      personaId: titular.id,
      email: 'ana@example.com',
      password: 'ClaveSegura123',
    });
    await cerrarSesion(db);

    const incorrecta = await iniciarSesion(
      db,
      'ana@example.com',
      'OtraClave123',
    ).then(
      () => null,
      (error: Error) => error,
    );
    const inexistente = await iniciarSesion(
      db,
      'nadie@example.com',
      'OtraClave123',
    ).then(
      () => null,
      (error: Error) => error,
    );

    expect(incorrecta).toBeInstanceOf(ErrorValidacion);
    expect(inexistente).toBeInstanceOf(ErrorValidacion);
    expect(incorrecta?.message).toBe(inexistente?.message);
    expect(incorrecta?.message).not.toMatch(/existe/i);
  });

  it('PA-CU23-03 bloquea tras superar el límite de intentos', async () => {
    const titular = await persona('Ana', 'Alvarez');
    await configurarAcceso(db, {
      personaId: titular.id,
      email: 'ana@example.com',
      password: 'ClaveSegura123',
    });
    await cerrarSesion(db);

    const inicio = new Date('2026-11-24T10:00:00.000Z');
    for (let i = 0; i < 5; i++) {
      await expect(
        iniciarSesion(db, 'ana@example.com', 'MalaClave123', inicio),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    }

    await expect(
      iniciarSesion(db, 'ana@example.com', 'ClaveSegura123', inicio),
    ).rejects.toBeInstanceOf(ErrorReglaNegocio);

    const despues = new Date('2026-11-24T10:06:00.000Z');
    const sesion = await iniciarSesion(
      db,
      'ana@example.com',
      'ClaveSegura123',
      despues,
    );
    expect(sesion.email).toBe('ana@example.com');
  });

  it('PA-CU23-04 un usuario inactivo no puede iniciar sesión', async () => {
    const titular = await persona('Ana', 'Alvarez');
    const usuario = await configurarAcceso(db, {
      personaId: titular.id,
      email: 'ana@example.com',
      password: 'ClaveSegura123',
    });
    await cerrarSesion(db);
    await db.usuarios.update(usuario.id, { activo: false });

    await expect(
      iniciarSesion(db, 'ana@example.com', 'ClaveSegura123'),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect(await sesionActual(db)).toBeNull();
  });

  it('PA-CU23-05 la identidad sale de la sesión local', async () => {
    const titular = await persona('Nayeli', 'Zapata Yamo');
    await configurarAcceso(db, {
      personaId: titular.id,
      email: 'nayeli@example.com',
      password: 'ClaveSegura123',
    });
    await cerrarSesion(db);
    await iniciarSesion(db, 'nayeli@example.com', 'ClaveSegura123');

    const sesion = await sesionActual(db);
    expect(sesion?.personaId).toBe(titular.id);
    expect(sesion?.rol).toBe('ADMIN');
  });

  it('PA-CU23-06 crea un acceso de miembro para una persona', async () => {
    const admin = await persona('Ana', 'Alvarez');
    const miembro = await persona('Beto', 'Benitez');
    await configurarAcceso(db, {
      personaId: admin.id,
      email: 'ana@example.com',
      password: 'ClaveSegura123',
    });

    const acceso = await crearAccesoPersona(db, {
      personaId: miembro.id,
      email: 'beto@example.com',
      password: 'Miembro12345',
    });
    expect(acceso.rol).toBe('MEMBER');
    expect(acceso.personaId).toBe(miembro.id);

    await cerrarSesion(db);
    const sesion = await iniciarSesion(
      db,
      'beto@example.com',
      'Miembro12345',
    );
    expect(sesion.rol).toBe('MEMBER');
    expect((await sesionActual(db))?.personaId).toBe(miembro.id);
  });

  it('PA-CU23-07 la recuperación remota no está disponible sin servidor', async () => {
    await expect(recuperarAcceso()).rejects.toBeInstanceOf(
      ErrorReglaNegocio,
    );
    await expect(recuperarAcceso()).rejects.toThrow(/sin servidor|respaldo/i);
  });

  it('rechaza correos duplicados y contraseñas cortas', async () => {
    const titular = await persona('Ana', 'Alvarez');
    await configurarAcceso(db, {
      personaId: titular.id,
      email: 'ana@example.com',
      password: 'ClaveSegura123',
    });
    const otro = await persona('Beto', 'Benitez');
    await expect(
      crearAccesoPersona(db, {
        personaId: otro.id,
        email: 'ana@example.com',
        password: 'Miembro12345',
      }),
    ).rejects.toBeInstanceOf(ErrorReglaNegocio);
    await expect(
      crearAccesoPersona(db, {
        personaId: otro.id,
        email: 'beto@example.com',
        password: '123',
      }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });
});
