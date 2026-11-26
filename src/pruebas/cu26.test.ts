import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { crearBaseDeDatos, type BaseDatos } from '../infraestructura/persistencia/baseDatos';
import { procesarComprobante } from '../infraestructura/imagen/comprobantes';
import { generarPeriodo } from '../aplicacion/cargos';
import { agregarMiembro } from '../aplicacion/miembros';
import {
  obtenerObligacionesPendientes,
  registrarPago,
} from '../aplicacion/pagos';
import { registrarPersona } from '../aplicacion/personas';
import { crearPrestamo } from '../aplicacion/prestamos';
import {
  exportarDatos,
  type PaqueteQoriGo,
} from '../aplicacion/respaldo';
import {
  importarDatos,
  previsualizarImportacion,
} from '../aplicacion/importacion';
import { configurarAcceso } from '../aplicacion/sesion';
import { crearSuscripcion } from '../aplicacion/suscripciones';
import { ErrorConflicto, ErrorValidacion } from '../dominio/errores';
import { baseTemporal, destruirBase } from './util';
import { decodificarConSharp } from './imagen';

let db: BaseDatos;

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function origen(): Promise<PaqueteQoriGo> {
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
      width: 80,
      height: 80,
      channels: 3,
      background: { r: 200, g: 100, b: 20 },
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

  return exportarDatos(db);
}

function copia<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

describe('CU-26 Importar datos', () => {
  it('PA-CU26-01 la vista previa no modifica la base', async () => {
    const paquete = await origen();
    const destino = crearBaseDeDatos(`${db.name}-destino-1`);
    const antes = await destino.personas.count();

    const preview = previsualizarImportacion(copia(paquete));

    expect(preview.valido).toBe(true);
    expect(preview.errores).toHaveLength(0);
    expect(preview.conteos.personas).toBe(1);
    expect(preview.conteos.comprobantes).toBe(1);
    expect(preview.exportedAt).toBeTruthy();
    expect(await destino.personas.count()).toBe(antes);
    destino.close();
  });

  it('PA-CU26-02 restaura los datos y conserva los UUID', async () => {
    const paquete = await origen();
    const destino = crearBaseDeDatos(`${db.name}-destino-2`);

    const resultado = await importarDatos(destino, copia(paquete), {
      modo: 'REEMPLAZAR',
    });

    expect(resultado.importados.personas).toBe(1);
    expect(await destino.personas.count()).toBe(1);
    expect(await destino.suscripciones.count()).toBe(1);
    expect(await destino.prestamos.count()).toBe(1);
    expect(await destino.pagos.count()).toBe(1);
    expect(await destino.comprobantesPago.count()).toBe(1);
    expect((await destino.personas.toArray())[0]?.id).toBe(
      paquete.data.personas[0]?.id,
    );
    expect((await destino.comprobantesPago.toArray())[0]?.imagen.size).toBeGreaterThan(
      0,
    );
    destino.close();
  });

  it('PA-CU26-03 reemplaza los datos locales y conserva el acceso del dispositivo', async () => {
    const paquete = await origen();
    const destino = crearBaseDeDatos(`${db.name}-destino-3`);
    const local = (
      await registrarPersona(
        destino,
        { nombres: 'Beto', apellidos: 'Benitez' },
        { resolucionSimilar: 'crear' },
      )
    ).persona!;
    await configurarAcceso(destino, {
      personaId: local.id,
      email: 'beto@example.com',
      password: 'ClaveSegura123',
    });

    await importarDatos(destino, copia(paquete), { modo: 'REEMPLAZAR' });

    const personas = await destino.personas.toArray();
    expect(personas).toHaveLength(1);
    expect(personas[0]?.nombres).toBe('Ana');
    expect(await destino.usuarios.count()).toBe(1);
    expect(
      (await destino.configuracion.get('acceso_configurado'))?.valor,
    ).toBe('SI');
    destino.close();
  });

  it('PA-CU26-04 una vista previa inválida no escribe nada', async () => {
    const destino = crearBaseDeDatos(`${db.name}-destino-4`);
    const preview = previsualizarImportacion({ format: 'otro' });

    expect(preview.valido).toBe(false);
    expect(await destino.personas.count()).toBe(0);
    destino.close();
  });

  it('PA-CU26-05 combinar no duplica registros idénticos', async () => {
    const paquete = await origen();
    const destino = crearBaseDeDatos(`${db.name}-destino-5`);
    await importarDatos(destino, copia(paquete), { modo: 'COMBINAR' });

    const segunda = await importarDatos(destino, copia(paquete), {
      modo: 'COMBINAR',
    });

    expect(segunda.importados.personas).toBe(0);
    expect(segunda.omitidos.personas).toBe(1);
    expect(segunda.omitidos.comprobantes).toBe(1);
    expect(await destino.personas.count()).toBe(1);
    expect(await destino.comprobantesPago.count()).toBe(1);
    destino.close();
  });

  it('PA-CU26-06 un UUID con otro contenido cancela la combinación', async () => {
    const paquete = await origen();
    const destino = crearBaseDeDatos(`${db.name}-destino-6`);
    await importarDatos(destino, copia(paquete), { modo: 'COMBINAR' });
    const personaId = paquete.data.personas[0]!.id;
    await destino.personas.update(personaId, { nombres: 'Cambiada' });

    await expect(
      importarDatos(destino, copia(paquete), { modo: 'COMBINAR' }),
    ).rejects.toBeInstanceOf(ErrorConflicto);
    expect((await destino.personas.get(personaId))?.nombres).toBe('Cambiada');
    destino.close();
  });

  it('PA-CU26-07 rechaza un JSON malformado', async () => {
    await expect(
      importarDatos(db, '{esto no es json', { modo: 'REEMPLAZAR' }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect(await db.personas.count()).toBe(0);
  });

  it('PA-CU26-08 rechaza una versión futura', async () => {
    const paquete = copia(await origen());
    paquete.formatVersion = 99;

    const preview = previsualizarImportacion(paquete);
    expect(preview.valido).toBe(false);
    expect(preview.errores.join(' ')).toMatch(/versión|version/i);

    const destino = crearBaseDeDatos(`${db.name}-destino-8`);
    await expect(
      importarDatos(destino, paquete, { modo: 'REEMPLAZAR' }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    destino.close();
  });

  it('PA-CU26-09 rechaza referencias inexistentes', async () => {
    const paquete = copia(await origen());
    paquete.data.aplicacionesPago[0]!.cuotaId =
      '00000000-0000-4000-8000-000000000000';
    paquete.data.aplicacionesPago[0]!.cargoId = undefined;
    paquete.data.cargosSuscripcion[0]!.miembroId =
      '00000000-0000-4000-8000-000000000001';

    const preview = previsualizarImportacion(paquete);
    expect(preview.valido).toBe(false);
    expect(preview.errores.length).toBeGreaterThan(0);

    const destino = crearBaseDeDatos(`${db.name}-destino-9`);
    await expect(
      importarDatos(destino, paquete, { modo: 'REEMPLAZAR' }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect(await destino.personas.count()).toBe(0);
    destino.close();
  });

  it('PA-CU26-10 rechaza un comprobante que no es PNG', async () => {
    const paquete = copia(await origen());
    paquete.data.comprobantes[0]!.imagenBase64 =
      'ZXN0byBubyBlcyB1bmEgaW1hZ2Vu';

    const preview = previsualizarImportacion(paquete);

    expect(preview.valido).toBe(false);
    expect(preview.errores.join(' ')).toMatch(/PNG|Base64/i);
  });

  it('PA-CU26-11 revierte todo si falla la transacción', async () => {
    const paquete = await origen();
    const destino = crearBaseDeDatos(`${db.name}-destino-11`);
    const existente = (
      await registrarPersona(
        destino,
        { nombres: 'Beto', apellidos: 'Benitez' },
        { resolucionSimilar: 'crear' },
      )
    ).persona!;

    await expect(
      importarDatos(destino, copia(paquete), {
        modo: 'REEMPLAZAR',
        alInsertar: (coleccion) => {
          if (coleccion === 'pagos') throw new Error('Fallo simulado');
        },
      }),
    ).rejects.toThrow(/Fallo simulado/);

    expect((await destino.personas.get(existente.id))?.nombres).toBe('Beto');
    expect(await destino.personas.count()).toBe(1);
    destino.close();
  });

  it('PA-CU26-12 tras importar, las instalaciones siguen independientes', async () => {
    const paquete = await origen();
    const destino = crearBaseDeDatos(`${db.name}-destino-12`);
    await importarDatos(destino, copia(paquete), { modo: 'REEMPLAZAR' });

    await registrarPersona(
      db,
      { nombres: 'Kassandra', apellidos: 'Cisneros Zapata' },
      { resolucionSimilar: 'crear' },
    );

    expect(await db.personas.count()).toBe(2);
    expect(await destino.personas.count()).toBe(1);
    destino.close();
  });
});
