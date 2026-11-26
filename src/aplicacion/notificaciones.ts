import type { DatosQoriGo } from './puertos/persistencia';
import type {
  RecordatorioEnviado,
  TipoObligacion,
} from '../dominio/modelo';
import { guardarConfiguracion, leerConfiguracion } from './auditoria';
import { formatearMoneda } from '../dominio/dinero';
import {
  diasEntre,
  formatearFecha,
  hoy as hoyActual,
  periodoDe,
  sumarDias,
  vencimientoEnPeriodo,
} from '../dominio/fechas';
import { cargarAuxiliaresSaldos, pagadoDeCargo, pagadoDeCuota } from './saldos';

export type MomentoRecordatorio = 'AVISO' | 'HOY' | 'VENCIDO';

export interface Recordatorio {
  clave: string;
  tipo: TipoObligacion | 'FACTURACION';
  entidadId: string;
  titulo: string;
  cuerpo: string;
  fechaVencimiento: string;
  dias: number;
  momento: MomentoRecordatorio;
}

function momentoDe(dias: number): MomentoRecordatorio {
  if (dias < 0) return 'VENCIDO';
  if (dias === 0) return 'HOY';
  return 'AVISO';
}

function tituloSuscripcion(momento: MomentoRecordatorio, nombre: string) {
  if (momento === 'VENCIDO') return `Pago vencido: ${nombre}`;
  if (momento === 'HOY') return `Cobro de suscripción hoy: ${nombre}`;
  return `Cobro próximo: ${nombre}`;
}

function tituloPrestamo(momento: MomentoRecordatorio) {
  if (momento === 'VENCIDO') return 'Cuota de préstamo vencida';
  if (momento === 'HOY') return 'Cuota de préstamo vence hoy';
  return 'Cuota de préstamo próxima';
}

/**
 * Revisa las obligaciones pendientes y las fechas de facturación de las
 * suscripciones. Usa solo datos locales: funciona sin internet.
 */
export async function calcularRecordatorios(
  db: DatosQoriGo,
  opciones: { hoy?: string; diasAviso?: number } = {},
): Promise<Recordatorio[]> {
  const hoy = opciones.hoy ?? hoyActual();
  const diasAviso = Math.max(0, Math.min(30, opciones.diasAviso ?? 3));
  const limite = sumarDias(hoy, diasAviso);
  const aux = await cargarAuxiliaresSaldos(db);

  const [cargos, miembros, suscripciones, personas, prestamos, cuotas] =
    await Promise.all([
      db.cargosSuscripcion.toArray(),
      db.miembrosSuscripcion.toArray(),
      db.suscripciones.toArray(),
      db.personas.toArray(),
      db.prestamos.toArray(),
      db.cuotasPrestamo.toArray(),
    ]);

  const mapaMiembros = new Map(miembros.map((m) => [m.id, m]));
  const mapaSuscripciones = new Map(suscripciones.map((s) => [s.id, s]));
  const mapaPersonas = new Map(personas.map((p) => [p.id, p]));
  const mapaPrestamos = new Map(prestamos.map((p) => [p.id, p]));
  const recordatorios: Recordatorio[] = [];
  const periodosConCargos = new Set<string>();

  for (const cargo of cargos) {
    if (cargo.periodo === periodoDe(hoy)) {
      const miembro = mapaMiembros.get(cargo.miembroId);
      if (miembro) {
        periodosConCargos.add(`${miembro.suscripcionId}:${cargo.periodo}`);
      }
    }
  }

  for (const cargo of cargos) {
    if (cargo.estado === 'ANULADO' || cargo.estado === 'PAGADO') continue;
    const miembro = mapaMiembros.get(cargo.miembroId);
    const suscripcion = miembro
      ? mapaSuscripciones.get(miembro.suscripcionId)
      : undefined;
    if (!miembro || !suscripcion) continue;

    const saldo = Math.max(0, cargo.montoCentimos - pagadoDeCargo(aux, cargo.id));
    if (saldo <= 0) continue;
    if (cargo.fechaVencimiento > limite) continue;

    const dias = diasEntre(hoy, cargo.fechaVencimiento);
    const momento = momentoDe(dias);
    const persona = mapaPersonas.get(miembro.personaId);
    recordatorios.push({
      clave: `CARGO:${cargo.id}:${cargo.fechaVencimiento}:${momento}`,
      tipo: 'SUSCRIPCION',
      entidadId: cargo.id,
      titulo: tituloSuscripcion(momento, suscripcion.nombre),
      cuerpo: `${persona ? `${persona.apellidos}, ${persona.nombres}` : 'Miembro'}: ${formatearMoneda(saldo, suscripcion.moneda)} · vence ${formatearFecha(cargo.fechaVencimiento)}.`,
      fechaVencimiento: cargo.fechaVencimiento,
      dias,
      momento,
    });
  }

  for (const cuota of cuotas) {
    if (cuota.estado === 'PAGADA') continue;
    const prestamo = mapaPrestamos.get(cuota.prestamoId);
    if (!prestamo || prestamo.estado !== 'ACTIVO') continue;

    const saldo = Math.max(
      0,
      cuota.montoProgramadoCentimos - pagadoDeCuota(aux, cuota.id),
    );
    if (saldo <= 0) continue;
    if (cuota.fechaVencimiento > limite) continue;

    const dias = diasEntre(hoy, cuota.fechaVencimiento);
    const momento = momentoDe(dias);
    const persona = mapaPersonas.get(prestamo.personaId);
    recordatorios.push({
      clave: `CUOTA:${cuota.id}:${cuota.fechaVencimiento}:${momento}`,
      tipo: 'PRESTAMO',
      entidadId: cuota.id,
      titulo: tituloPrestamo(momento),
      cuerpo: `${persona ? `${persona.apellidos}, ${persona.nombres}` : 'Titular'} · cuota ${cuota.numeroCuota}/${prestamo.plazoMeses} · ${formatearMoneda(saldo, prestamo.moneda)} · vence ${formatearFecha(cuota.fechaVencimiento)}.`,
      fechaVencimiento: cuota.fechaVencimiento,
      dias,
      momento,
    });
  }

  // Día de facturación de suscripciones cuyo periodo todavía no tiene cargos.
  for (const suscripcion of suscripciones) {
    if (suscripcion.estado !== 'ACTIVA') continue;
    if (suscripcion.fechaInicio > hoy) continue;
    const periodo = periodoDe(hoy);
    if (periodosConCargos.has(`${suscripcion.id}:${periodo}`)) continue;

    const fechaCobro = vencimientoEnPeriodo(periodo, suscripcion.diaCobro);
    if (fechaCobro < hoy || fechaCobro > limite) continue;

    const dias = diasEntre(hoy, fechaCobro);
    const momento = momentoDe(dias);
    recordatorios.push({
      clave: `FACTURACION:${suscripcion.id}:${fechaCobro}:${momento}`,
      tipo: 'FACTURACION',
      entidadId: suscripcion.id,
      titulo: `Día de cobro: ${suscripcion.nombre}`,
      cuerpo: `Costo ${formatearMoneda(suscripcion.costoCentimos, suscripcion.moneda)} · ${formatearFecha(fechaCobro)}. Genera los cargos del periodo si aún no lo hiciste.`,
      fechaVencimiento: fechaCobro,
      dias,
      momento,
    });
  }

  return recordatorios.sort((a, b) => {
    if (a.fechaVencimiento !== b.fechaVencimiento) {
      return a.fechaVencimiento.localeCompare(b.fechaVencimiento);
    }
    return a.titulo.localeCompare(b.titulo, 'es');
  });
}

/* ---------------------------- Permisos ---------------------------- */

export type EstadoPermiso = NotificationPermission | 'no_soportado';

export function notificacionesSoportadas(): boolean {
  return typeof Notification !== 'undefined';
}

export function permisoNotificaciones(): EstadoPermiso {
  if (!notificacionesSoportadas()) return 'no_soportado';
  return Notification.permission;
}

export async function solicitarPermisoNotificaciones(): Promise<EstadoPermiso> {
  if (!notificacionesSoportadas()) return 'no_soportado';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/* --------------------------- Mostrar aviso ------------------------ */

export async function mostrarNotificacionNavegador(
  recordatorio: Recordatorio,
): Promise<void> {
  if (!notificacionesSoportadas()) {
    throw new Error('Este navegador no admite notificaciones.');
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Falta el permiso de notificaciones.');
  }

  const opciones: NotificationOptions = {
    body: recordatorio.cuerpo,
    icon: './icono-192.png',
    badge: './icono-192.png',
    tag: recordatorio.clave,
    data: { url: './#/pagos' },
  };

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registro = await navigator.serviceWorker.getRegistration();
    if (registro?.active) {
      await registro.showNotification(recordatorio.titulo, opciones);
      return;
    }
  }

  new Notification(recordatorio.titulo, opciones);
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
  permiso?: EstadoPermiso;
  mostrar?: (recordatorio: Recordatorio) => Promise<void>;
}

/**
 * Envía los recordatorios nuevos. Se apoya en datos locales, así que no
 * necesita internet. El navegador solo ejecuta esta revisión mientras la
 * aplicación está abierta o activa; no hay push desde un servidor.
 */
export async function ejecutarRecordatorios(
  db: DatosQoriGo,
  opciones: OpcionesEjecucion = {},
): Promise<ResultadoRecordatorios> {
  const activas =
    (await leerConfiguracion(db, 'notificaciones_activas', 'NO')) === 'SI';
  if (!activas) return { enviados: 0, omitidos: 0, motivo: 'desactivadas' };

  const permiso = opciones.permiso ?? permisoNotificaciones();
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

  const mostrar = opciones.mostrar ?? mostrarNotificacionNavegador;
  let enviados = 0;
  let omitidos = 0;

  for (const recordatorio of recordatorios) {
    if (await db.recordatorios.get(recordatorio.clave)) {
      omitidos += 1;
      continue;
    }
    await mostrar(recordatorio);
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
  diasAviso = 3,
): Promise<EstadoPermiso> {
  const permiso = await solicitarPermisoNotificaciones();
  await guardarConfiguracion(db, 'recordatorios_dias', String(diasAviso));
  await guardarConfiguracion(
    db,
    'notificaciones_activas',
    permiso === 'granted' ? 'SI' : 'NO',
  );
  return permiso;
}

export async function desactivarRecordatorios(db: DatosQoriGo): Promise<void> {
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
