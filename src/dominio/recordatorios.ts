import type {
  CargoSuscripcion,
  CuotaPrestamo,
  MiembroSuscripcion,
  Persona,
  Prestamo,
  Suscripcion,
  TipoObligacion,
} from './modelo';
import { diasEntre, periodoDe, sumarDias, vencimientoEnPeriodo } from './fechas';

export type MomentoRecordatorio = 'AVISO' | 'HOY' | 'VENCIDO';

export interface RecordatorioPendiente {
  clave: string;
  tipo: TipoObligacion | 'FACTURACION';
  entidadId: string;
  fechaVencimiento: string;
  dias: number;
  momento: MomentoRecordatorio;
  nombre: string;
  personaNombre?: string;
  detalle?: string;
  montoCentimos: number;
  moneda: string;
}

export interface SnapshotRecordatorios {
  hoy: string;
  diasAviso: number;
  cargos: CargoSuscripcion[];
  miembros: MiembroSuscripcion[];
  suscripciones: Suscripcion[];
  personas: Persona[];
  prestamos: Prestamo[];
  cuotas: CuotaPrestamo[];
  pagadoCargo: (cargoId: string) => number;
  pagadoCuota: (cuotaId: string) => number;
}

function momentoDe(dias: number): MomentoRecordatorio {
  if (dias < 0) return 'VENCIDO';
  if (dias === 0) return 'HOY';
  return 'AVISO';
}

function nombrePersona(persona: Persona | undefined): string | undefined {
  return persona ? `${persona.apellidos}, ${persona.nombres}` : undefined;
}

/**
 * Regla pura de recordatorios: a partir de una foto de los datos decide qué
 * avisos corresponden. No conoce IndexedDB, notificaciones ni la interfaz.
 */
export function calcularRecordatoriosPendientes(
  snapshot: SnapshotRecordatorios,
): RecordatorioPendiente[] {
  const { hoy } = snapshot;
  const diasAviso = Math.max(0, Math.min(30, snapshot.diasAviso));
  const limite = sumarDias(hoy, diasAviso);

  const mapaMiembros = new Map(snapshot.miembros.map((m) => [m.id, m]));
  const mapaSuscripciones = new Map(
    snapshot.suscripciones.map((s) => [s.id, s]),
  );
  const mapaPersonas = new Map(snapshot.personas.map((p) => [p.id, p]));
  const mapaPrestamos = new Map(snapshot.prestamos.map((p) => [p.id, p]));
  const periodosConCargos = new Set<string>();
  const recordatorios: RecordatorioPendiente[] = [];

  for (const cargo of snapshot.cargos) {
    if (cargo.periodo !== periodoDe(hoy)) continue;
    const miembro = mapaMiembros.get(cargo.miembroId);
    if (miembro) {
      periodosConCargos.add(`${miembro.suscripcionId}:${cargo.periodo}`);
    }
  }

  for (const cargo of snapshot.cargos) {
    if (cargo.estado === 'ANULADO' || cargo.estado === 'PAGADO') continue;
    const miembro = mapaMiembros.get(cargo.miembroId);
    const suscripcion = miembro
      ? mapaSuscripciones.get(miembro.suscripcionId)
      : undefined;
    if (!miembro || !suscripcion) continue;

    const saldo = Math.max(
      0,
      cargo.montoCentimos - snapshot.pagadoCargo(cargo.id),
    );
    if (saldo <= 0 || cargo.fechaVencimiento > limite) continue;

    const dias = diasEntre(hoy, cargo.fechaVencimiento);
    const momento = momentoDe(dias);
    recordatorios.push({
      clave: `CARGO:${cargo.id}:${cargo.fechaVencimiento}:${momento}`,
      tipo: 'SUSCRIPCION',
      entidadId: cargo.id,
      fechaVencimiento: cargo.fechaVencimiento,
      dias,
      momento,
      nombre: suscripcion.nombre,
      personaNombre: nombrePersona(mapaPersonas.get(miembro.personaId)),
      montoCentimos: saldo,
      moneda: suscripcion.moneda,
    });
  }

  for (const cuota of snapshot.cuotas) {
    if (cuota.estado === 'PAGADA') continue;
    const prestamo = mapaPrestamos.get(cuota.prestamoId);
    if (!prestamo || prestamo.estado !== 'ACTIVO') continue;

    const saldo = Math.max(
      0,
      cuota.montoProgramadoCentimos - snapshot.pagadoCuota(cuota.id),
    );
    if (saldo <= 0 || cuota.fechaVencimiento > limite) continue;

    const dias = diasEntre(hoy, cuota.fechaVencimiento);
    const momento = momentoDe(dias);
    recordatorios.push({
      clave: `CUOTA:${cuota.id}:${cuota.fechaVencimiento}:${momento}`,
      tipo: 'PRESTAMO',
      entidadId: cuota.id,
      fechaVencimiento: cuota.fechaVencimiento,
      dias,
      momento,
      nombre: 'Préstamo',
      personaNombre: nombrePersona(mapaPersonas.get(prestamo.personaId)),
      detalle: `Cuota ${cuota.numeroCuota}/${prestamo.plazoMeses}`,
      montoCentimos: saldo,
      moneda: prestamo.moneda,
    });
  }

  for (const suscripcion of snapshot.suscripciones) {
    if (suscripcion.estado !== 'ACTIVA') continue;
    if (suscripcion.fechaInicio > hoy) continue;

    const periodo = periodoDe(hoy);
    if (periodosConCargos.has(`${suscripcion.id}:${periodo}`)) continue;

    const fechaCobro = vencimientoEnPeriodo(periodo, suscripcion.diaCobro);
    if (fechaCobro < hoy || fechaCobro > limite) continue;

    const dias = diasEntre(hoy, fechaCobro);
    recordatorios.push({
      clave: `FACTURACION:${suscripcion.id}:${fechaCobro}:${momentoDe(dias)}`,
      tipo: 'FACTURACION',
      entidadId: suscripcion.id,
      fechaVencimiento: fechaCobro,
      dias,
      momento: momentoDe(dias),
      nombre: suscripcion.nombre,
      montoCentimos: suscripcion.costoCentimos,
      moneda: suscripcion.moneda,
    });
  }

  return recordatorios.sort((a, b) => {
    if (a.fechaVencimiento !== b.fechaVencimiento) {
      return a.fechaVencimiento.localeCompare(b.fechaVencimiento);
    }
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}
