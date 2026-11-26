import type { DatosQoriGo } from './puertos/persistencia';
import type {
  AvisoNotificacion,
  EstadoPermiso,
  Notificador,
} from './puertos/notificador';
import type { RecordatorioEnviado } from '../dominio/modelo';
import {
  calcularRecordatoriosPendientes,
  type MomentoRecordatorio,
  type RecordatorioPendiente,
} from '../dominio/recordatorios';
import { guardarConfiguracion, leerConfiguracion } from './auditoria';
import { formatearMoneda } from '../dominio/dinero';
import { formatearFecha, hoy as hoyActual } from '../dominio/fechas';
import { cargarAuxiliaresSaldos, pagadoDeCargo, pagadoDeCuota } from './saldos';

export type { EstadoPermiso, Notificador } from './puertos/notificador';
export type { MomentoRecordatorio } from '../dominio/recordatorios';

export interface Recordatorio {
  clave: string;
  tipo: 'SUSCRIPCION' | 'PRESTAMO' | 'FACTURACION';
  entidadId: string;
  titulo: string;
  cuerpo: string;
  fechaVencimiento: string;
  dias: number;
  momento: MomentoRecordatorio;
}

function tituloDe(pendiente: RecordatorioPendiente): string {
  if (pendiente.tipo === 'FACTURACION') {
    return `Día de cobro: ${pendiente.nombre}`;
  }
  if (pendiente.tipo === 'PRESTAMO') {
    if (pendiente.momento === 'VENCIDO') return 'Cuota de préstamo vencida';
    if (pendiente.momento === 'HOY') return 'Cuota de préstamo vence hoy';
    return 'Cuota de préstamo próxima';
  }
  if (pendiente.momento === 'VENCIDO') {
    return `Pago vencido: ${pendiente.nombre}`;
  }
  if (pendiente.momento === 'HOY') {
    return `Cobro de suscripción hoy: ${pendiente.nombre}`;
  }
  return `Cobro próximo: ${pendiente.nombre}`;
}

function cuerpoDe(pendiente: RecordatorioPendiente): string {
  const monto = formatearMoneda(pendiente.montoCentimos, pendiente.moneda);
  const fecha = formatearFecha(pendiente.fechaVencimiento);

  if (pendiente.tipo === 'FACTURACION') {
    return `Costo ${monto} · ${fecha}. Genera los cargos del periodo si aún no lo hiciste.`;
  }
  const persona = pendiente.personaNombre ?? 'Miembro';
  if (pendiente.tipo === 'PRESTAMO') {
    return `${persona} · ${pendiente.detalle ?? 'Cuota'} · ${monto} · vence ${fecha}.`;
  }
  return `${persona}: ${monto} · vence ${fecha}.`;
}

function aRecordatorio(pendiente: RecordatorioPendiente): Recordatorio {
  return {
    clave: pendiente.clave,
    tipo: pendiente.tipo,
    entidadId: pendiente.entidadId,
    titulo: tituloDe(pendiente),
    cuerpo: cuerpoDe(pendiente),
    fechaVencimiento: pendiente.fechaVencimiento,
    dias: pendiente.dias,
    momento: pendiente.momento,
  };
}

/**
 * Revisa las obligaciones pendientes y las fechas de facturación. Usa solo
 * datos locales: funciona sin internet.
 */
export async function calcularRecordatorios(
  db: DatosQoriGo,
  opciones: { hoy?: string; diasAviso?: number } = {},
): Promise<Recordatorio[]> {
  const [
    cargos,
    miembros,
    suscripciones,
    personas,
    prestamos,
    cuotas,
    aux,
  ] = await Promise.all([
    db.cargosSuscripcion.toArray(),
    db.miembrosSuscripcion.toArray(),
    db.suscripciones.toArray(),
    db.personas.toArray(),
    db.prestamos.toArray(),
    db.cuotasPrestamo.toArray(),
    cargarAuxiliaresSaldos(db),
  ]);

  return calcularRecordatoriosPendientes({
    hoy: opciones.hoy ?? hoyActual(),
    diasAviso: opciones.diasAviso ?? 3,
    cargos,
    miembros,
    suscripciones,
    personas,
    prestamos,
    cuotas,
    pagadoCargo: (id) => pagadoDeCargo(aux, id),
    pagadoCuota: (id) => pagadoDeCuota(aux, id),
  }).map(aRecordatorio);
}

/* ---------------------------- Ejecución --------------------------- */

export type MotivoSinAviso =
  | 'desactivadas'
  | 'no_soportado'
  | 'sin_permiso'
  | 'sin_recordatorios'
  | 'sin_nuevos';

export interface ResultadoRecordatorios {
  enviados: number;
  omitidos: number;
  motivo?: MotivoSinAviso;
}

export interface OpcionesEjecucion {
  hoy?: string;
  notificador?: Notificador;
}

const NOTIFICADOR_NULO: Notificador = {
  permiso: () => 'no_soportado',
  solicitarPermiso: async () => 'no_soportado',
  mostrar: async () => {
    throw new Error('No hay un notificador configurado.');
  },
};

/**
 * Envía los recordatorios nuevos. Necesita un adaptador de notificaciones;
 * el contenedor de la interfaz inyecta el del navegador.
 */
export async function ejecutarRecordatorios(
  db: DatosQoriGo,
  opciones: OpcionesEjecucion = {},
): Promise<ResultadoRecordatorios> {
  const activas =
    (await leerConfiguracion(db, 'notificaciones_activas', 'NO')) === 'SI';
  if (!activas) return { enviados: 0, omitidos: 0, motivo: 'desactivadas' };

  const notificador = opciones.notificador ?? NOTIFICADOR_NULO;
  const permiso = notificador.permiso();
  if (permiso === 'no_soportado') {
    return { enviados: 0, omitidos: 0, motivo: 'no_soportado' };
  }
  if (permiso !== 'granted') {
    return { enviados: 0, omitidos: 0, motivo: 'sin_permiso' };
  }

  const dias = Number(
    await leerConfiguracion(db, 'recordatorios_dias', '3'),
  );
  const recordatorios = await calcularRecordatorios(db, {
    hoy: opciones.hoy,
    diasAviso: Number.isFinite(dias) ? dias : 3,
  });
  if (recordatorios.length === 0) {
    return { enviados: 0, omitidos: 0, motivo: 'sin_recordatorios' };
  }

  let enviados = 0;
  let omitidos = 0;

  for (const recordatorio of recordatorios) {
    if (await db.recordatorios.get(recordatorio.clave)) {
      omitidos += 1;
      continue;
    }
    const aviso: AvisoNotificacion = {
      clave: recordatorio.clave,
      titulo: recordatorio.titulo,
      cuerpo: recordatorio.cuerpo,
    };
    await notificador.mostrar(aviso);
    const registro: RecordatorioEnviado = {
      clave: recordatorio.clave,
      tipo: recordatorio.tipo,
      entidadId: recordatorio.entidadId,
      fechaVencimiento: recordatorio.fechaVencimiento,
      enviadoEn: new Date().toISOString(),
    };
    await db.recordatorios.put(registro);
    enviados += 1;
  }

  return {
    enviados,
    omitidos,
    motivo: enviados === 0 ? 'sin_nuevos' : undefined,
  };
}

/* --------------------------- Configuración ------------------------ */

export async function activarRecordatorios(
  db: DatosQoriGo,
  notificador: Notificador,
  diasAviso = 3,
): Promise<EstadoPermiso> {
  const permiso = await notificador.solicitarPermiso();
  await guardarConfiguracion(db, 'recordatorios_dias', String(diasAviso));
  await guardarConfiguracion(
    db,
    'notificaciones_activas',
    permiso === 'granted' ? 'SI' : 'NO',
  );
  return permiso;
}

export async function desactivarRecordatorios(
  db: DatosQoriGo,
): Promise<void> {
  await guardarConfiguracion(db, 'notificaciones_activas', 'NO');
}

export async function guardarDiasRecordatorio(
  db: DatosQoriGo,
  dias: number,
): Promise<void> {
  const valor = Math.max(0, Math.min(30, Math.round(dias)));
  await guardarConfiguracion(db, 'recordatorios_dias', String(valor));
}

export function recordatorioDePrueba(): Recordatorio {
  return {
    clave: `PRUEBA:${Date.now()}`,
    tipo: 'FACTURACION',
    entidadId: 'prueba',
    titulo: 'Recordatorio de prueba',
    cuerpo: 'Así se verá un aviso de QoriGo en este dispositivo.',
    fechaVencimiento: hoyActual(),
    dias: 0,
    momento: 'HOY',
  };
}
