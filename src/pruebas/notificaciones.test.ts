import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseDatos } from '../db/baseDatos';
import {
  calcularRecordatorios,
  ejecutarRecordatorios,
} from '../aplicacion/notificaciones';
import type {
  AvisoNotificacion,
  EstadoPermiso,
  Notificador,
} from '../aplicacion/puertos/notificador';
import {
  notificacionesSoportadas,
  permisoNotificaciones,
  solicitarPermisoNotificaciones,
} from '../infraestructura/notificaciones/navegador';
import { agregarMiembro } from '../aplicacion/miembros';
import { registrarPersona } from '../aplicacion/personas';
import { crearPrestamo } from '../aplicacion/prestamos';
import { crearSuscripcion } from '../aplicacion/suscripciones';
import { nuevoId } from '../dominio/ids';
import { baseTemporal, destruirBase } from './util';

let db: BaseDatos;

const HOY = '2026-11-25';

function crearNotificador(estado: EstadoPermiso = 'granted') {
  const mostrados: AvisoNotificacion[] = [];
  const notificador: Notificador = {
    permiso: () => estado,
    solicitarPermiso: async () => estado,
    mostrar: async (aviso) => {
      mostrados.push(aviso);
    },
  };
  return { notificador, mostrados };
}

beforeEach(async () => {
  db = await baseTemporal();
});

afterEach(async () => {
  await destruirBase(db);
});

async function persona() {
  const alta = await registrarPersona(
    db,
    { nombres: 'Nayeli', apellidos: 'Zapata Yamo' },
    { resolucionSimilar: 'crear' },
  );
  return alta.persona!;
}

async function contexto() {
  const titular = await persona();
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
  const agregado = await agregarMiembro(db, suscripcion.id, {
    personaId: titular.id,
    montoAcordado: '15.00',
    fechaInicio: '2026-01-01',
  });
  return { titular, suscripcion, miembro: agregado.miembro };
}

async function crearCargo(
  miembroId: string,
  montoCentimos: number,
  fechaVencimiento: string,
  estado: 'PENDIENTE' | 'PAGADO' = 'PENDIENTE',
) {
  const id = nuevoId();
  await db.cargosSuscripcion.add({
    id,
    miembroId,
    periodo: '2026-11-01',
    montoCentimos,
    fechaVencimiento,
    estado,
  });
  return id;
}

async function escenarioCargos() {
  const base = await contexto();
  const vencido = await crearCargo(base.miembro.id, 1500, '2026-11-24');
  const hoy = await crearCargo(base.miembro.id, 1500, '2026-11-25');
  const proximo = await crearCargo(base.miembro.id, 1500, '2026-11-27');
  const lejano = await crearCargo(base.miembro.id, 1500, '2026-12-05');
  const pagado = await crearCargo(
    base.miembro.id,
    1500,
    '2026-11-25',
    'PAGADO',
  );

  const prestamo = await crearPrestamo(db, {
    personaId: base.titular.id,
    moneda: 'PEN',
    capital: '300.00',
    tasaMensual: 0,
    plazoMeses: 3,
    fechaPrestamo: '2026-10-26',
    fechaPrimerPago: '2026-11-26',
    estrictoCumplimiento: false,
  });

  return {
    ...base,
    vencido,
    hoy,
    proximo,
    lejano,
    pagado,
    prestamo: prestamo.prestamo,
  };
}

describe('Recordatorios de pago', () => {
  it('calcula vencidos, de hoy y próximos dentro de la ventana', async () => {
    const datos = await escenarioCargos();

    const recordatorios = await calcularRecordatorios(db, {
      hoy: HOY,
      diasAviso: 3,
    });

    expect(recordatorios).toHaveLength(4);
    expect(recordatorios.map((r) => r.momento).sort()).toEqual([
      'AVISO',
      'AVISO',
      'HOY',
      'VENCIDO',
    ]);
    const claves = recordatorios.map((r) => r.clave).join(' ');
    expect(claves).toContain(datos.vencido);
    expect(claves).toContain(datos.hoy);
    expect(claves).toContain(datos.proximo);
    expect(claves).not.toContain(datos.lejano);
    expect(claves).not.toContain(datos.pagado);

    const deSuscripcion = recordatorios.filter(
      (r) => r.tipo === 'SUSCRIPCION',
    );
    expect(deSuscripcion[0]?.titulo).toContain('YouTube Premium');
    expect(deSuscripcion[0]?.cuerpo).toContain('Zapata Yamo, Nayeli');

    const dePrestamo = recordatorios.find((r) => r.tipo === 'PRESTAMO')!;
    expect(dePrestamo.cuerpo).toContain('Cuota 1/3');
  });

  it('avisa el día de facturación cuando el periodo aún no tiene cargos', async () => {
    const plataforma = await db.plataformas
      .filter((p) => p.nombre === 'Microsoft')
      .first();
    await crearSuscripcion(db, {
      plataformaId: plataforma!.id,
      nombre: 'Microsoft 365',
      moneda: 'PEN',
      costo: '37.99',
      capacidad: 6,
      diaCobro: 27,
      fechaInicio: '2026-01-01',
    });

    const recordatorios = await calcularRecordatorios(db, {
      hoy: HOY,
      diasAviso: 3,
    });

    expect(recordatorios).toHaveLength(1);
    expect(recordatorios[0]?.tipo).toBe('FACTURACION');
    expect(recordatorios[0]?.titulo).toContain('Microsoft 365');
    expect(recordatorios[0]?.cuerpo).toContain('Genera los cargos');
    expect(recordatorios[0]?.fechaVencimiento).toBe('2026-11-27');
  });

  it('envía una sola vez cada aviso y evita duplicados', async () => {
    await escenarioCargos();
    await db.configuracion.put({
      clave: 'notificaciones_activas',
      valor: 'SI',
    });
    await db.configuracion.put({ clave: 'recordatorios_dias', valor: '3' });
    const { notificador, mostrados } = crearNotificador();

    const primera = await ejecutarRecordatorios(db, {
      hoy: HOY,
      notificador,
    });
    const segunda = await ejecutarRecordatorios(db, {
      hoy: HOY,
      notificador,
    });

    expect(primera.enviados).toBe(4);
    expect(segunda.enviados).toBe(0);
    expect(segunda.omitidos).toBe(4);
    expect(segunda.motivo).toBe('sin_nuevos');
    expect(mostrados).toHaveLength(4);
    expect(await db.recordatorios.count()).toBe(4);
  });

  it('no envía si está desactivado o sin permiso', async () => {
    await escenarioCargos();

    const desactivado = await ejecutarRecordatorios(db, {
      hoy: HOY,
      notificador: crearNotificador().notificador,
    });
    expect(desactivado.motivo).toBe('desactivadas');
    expect(desactivado.enviados).toBe(0);

    await db.configuracion.put({
      clave: 'notificaciones_activas',
      valor: 'SI',
    });
    const sinPermiso = await ejecutarRecordatorios(db, {
      hoy: HOY,
      notificador: crearNotificador('default').notificador,
    });
    expect(sinPermiso.motivo).toBe('sin_permiso');

    const noSoportado = await ejecutarRecordatorios(db, {
      hoy: HOY,
      notificador: crearNotificador('no_soportado').notificador,
    });
    expect(noSoportado.motivo).toBe('no_soportado');
    expect(await db.recordatorios.count()).toBe(0);
  });

  it('vuelve a avisar el mismo día del vencimiento', async () => {
    const base = await contexto();
    await crearCargo(base.miembro.id, 1500, '2026-11-26');
    await db.configuracion.put({
      clave: 'notificaciones_activas',
      valor: 'SI',
    });
    await db.configuracion.put({ clave: 'recordatorios_dias', valor: '3' });
    const { notificador, mostrados } = crearNotificador();

    const aviso = await ejecutarRecordatorios(db, {
      hoy: '2026-11-24',
      notificador,
    });
    const hoy = await ejecutarRecordatorios(db, {
      hoy: '2026-11-26',
      notificador,
    });
    const repetido = await ejecutarRecordatorios(db, {
      hoy: '2026-11-26',
      notificador,
    });

    expect(aviso.enviados).toBe(1);
    expect(aviso.motivo).toBeUndefined();
    expect(hoy.enviados).toBe(1);
    expect(repetido.enviados).toBe(0);
    expect(mostrados.map((avisoMostrado) => avisoMostrado.titulo)).toEqual([
      'Cobro próximo: YouTube Premium',
      'Cobro de suscripción hoy: YouTube Premium',
    ]);
  });

  it('maneja un entorno sin soporte de notificaciones', async () => {
    expect(notificacionesSoportadas()).toBe(false);
    expect(permisoNotificaciones()).toBe('no_soportado');
    await expect(solicitarPermisoNotificaciones()).resolves.toBe(
      'no_soportado',
    );
  });
});
