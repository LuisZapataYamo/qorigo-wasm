import type { BaseDatos } from '../db/baseDatos';
import type {
  AplicacionPago,
  CargoSuscripcion,
  CostoSuscripcionPeriodo,
  CuotaPrestamo,
  MiembroSuscripcion,
  Pago,
  Persona,
  Plataforma,
  Prestamo,
  Suscripcion,
  CausaPerdida,
} from '../db/tipos';
import {
  diasEntre,
  finDeMes,
  hoy,
  periodoActual,
  serieMeses,
  sumarDias,
  sumarMeses,
} from '../dominio/fechas';
import { cargarAuxiliaresSaldos, type AuxiliaresSaldos } from './saldos';

export interface ContextoReportes {
  personas: Persona[];
  plataformas: Plataforma[];
  suscripciones: Suscripcion[];
  miembros: MiembroSuscripcion[];
  cargos: CargoSuscripcion[];
  costos: CostoSuscripcionPeriodo[];
  prestamos: Prestamo[];
  cuotas: CuotaPrestamo[];
  pagos: Pago[];
  aplicaciones: AplicacionPago[];
  aux: AuxiliaresSaldos;
  umbralRiesgo: number;
  hoy: string;
  mapaPersonas: Map<string, Persona>;
  mapaSuscripciones: Map<string, Suscripcion>;
  mapaMiembros: Map<string, MiembroSuscripcion>;
  mapaPrestamos: Map<string, Prestamo>;
  mapaCuotas: Map<string, CuotaPrestamo>;
  mapaPagos: Map<string, Pago>;
  mapaCargos: Map<string, CargoSuscripcion>;
}

export async function cargarContexto(db: BaseDatos): Promise<ContextoReportes> {
  const [
    personas,
    plataformas,
    suscripciones,
    miembros,
    cargos,
    costos,
    prestamos,
    cuotas,
    pagos,
    aplicaciones,
    aux,
    config,
  ] = await Promise.all([
    db.personas.toArray(),
    db.plataformas.toArray(),
    db.suscripciones.toArray(),
    db.miembrosSuscripcion.toArray(),
    db.cargosSuscripcion.toArray(),
    db.costosSuscripcionPeriodo.toArray(),
    db.prestamos.toArray(),
    db.cuotasPrestamo.toArray(),
    db.pagos.toArray(),
    db.aplicacionesPago.toArray(),
    cargarAuxiliaresSaldos(db),
    db.configuracion.get('umbral_riesgo_dias'),
  ]);

  return {
    personas,
    plataformas,
    suscripciones,
    miembros,
    cargos,
    costos,
    prestamos,
    cuotas,
    pagos,
    aplicaciones,
    aux,
    umbralRiesgo: Number(config?.valor ?? '30'),
    hoy: hoy(),
    mapaPersonas: new Map(personas.map((p) => [p.id, p])),
    mapaSuscripciones: new Map(suscripciones.map((s) => [s.id, s])),
    mapaMiembros: new Map(miembros.map((m) => [m.id, m])),
    mapaPrestamos: new Map(prestamos.map((p) => [p.id, p])),
    mapaCuotas: new Map(cuotas.map((c) => [c.id, c])),
    mapaPagos: new Map(pagos.map((p) => [p.id, p])),
    mapaCargos: new Map(cargos.map((c) => [c.id, c])),
  };
}

function pagadoCargo(ctx: ContextoReportes, cargoId: string): number {
  return ctx.aplicaciones
    .filter((a) => a.cargoId === cargoId && ctx.aux.pagosRegistrados.has(a.pagoId))
    .reduce((t, a) => t + a.montoAplicadoCentimos, 0);
}

function pagadoCuota(ctx: ContextoReportes, cuotaId: string): number {
  return ctx.aplicaciones
    .filter((a) => a.cuotaId === cuotaId && ctx.aux.pagosRegistrados.has(a.pagoId))
    .reduce((t, a) => t + a.montoAplicadoCentimos, 0);
}

function aplicacionesEnPeriodo(
  ctx: ContextoReportes,
  periodo: string,
  moneda: string,
): AplicacionPago[] {
  const fin = finDeMes(periodo);
  return ctx.aplicaciones.filter((a) => {
    if (!ctx.aux.pagosRegistrados.has(a.pagoId)) return false;
    const pago = ctx.mapaPagos.get(a.pagoId);
    if (!pago || pago.moneda !== moneda) return false;
    return pago.fechaPago >= periodo && pago.fechaPago <= fin;
  });
}

function capitalRecuperadoPrestamo(
  ctx: ContextoReportes,
  prestamoId: string,
): number {
  const ids = new Set(
    ctx.cuotas.filter((c) => c.prestamoId === prestamoId).map((c) => c.id),
  );
  return ctx.aplicaciones
    .filter(
      (a) =>
        a.cuotaId &&
        ids.has(a.cuotaId) &&
        ctx.aux.pagosRegistrados.has(a.pagoId),
    )
    .reduce((t, a) => t + (a.montoCapitalCentimos ?? 0), 0);
}

function cobradoPrestamo(
  ctx: ContextoReportes,
  prestamoId: string,
): number {
  const ids = new Set(
    ctx.cuotas.filter((c) => c.prestamoId === prestamoId).map((c) => c.id),
  );
  return ctx.aplicaciones
    .filter(
      (a) =>
        a.cuotaId &&
        ids.has(a.cuotaId) &&
        ctx.aux.pagosRegistrados.has(a.pagoId),
    )
    .reduce((t, a) => t + a.montoAplicadoCentimos, 0);
}

function capitalEnLaCalle(ctx: ContextoReportes, moneda: string): number {
  return ctx.prestamos
    .filter((p) => p.estado === 'ACTIVO' && p.moneda === moneda)
    .reduce(
      (total, p) =>
        total + Math.max(0, p.capitalCentimos - capitalRecuperadoPrestamo(ctx, p.id)),
      0,
    );
}

export interface BalanceMes {
  periodo: string;
  moneda: string;
  ingresoSuscripcionesCentimos: number;
  ingresoPrestamosCentimos: number;
  ingresosCentimos: number;
  egresoCostosCentimos: number;
  egresoDesembolsosCentimos: number;
  egresosCentimos: number;
  balanceCajaCentimos: number;
  margenSuscripcionesCentimos: number;
  interesCobradoCentimos: number;
  perdidasIncobrablesCentimos: number;
  resultadoEconomicoCentimos: number;
  capitalEnLaCalleCentimos: number;
  rentabilidadPorcentaje: number;
}

function calcularBalance(
  ctx: ContextoReportes,
  periodo: string,
  moneda: string,
): BalanceMes {
  const aplicaciones = aplicacionesEnPeriodo(ctx, periodo, moneda);

  const ingresoSuscripciones = aplicaciones
    .filter((a) => a.cargoId)
    .reduce((t, a) => t + a.montoAplicadoCentimos, 0);
  const ingresoPrestamos = aplicaciones
    .filter((a) => a.cuotaId)
    .reduce((t, a) => t + a.montoAplicadoCentimos, 0);
  const interesCobrado = aplicaciones
    .filter((a) => a.cuotaId)
    .reduce((t, a) => t + (a.montoInteresCentimos ?? 0), 0);

  const egresoCostos = ctx.costos
    .filter(
      (c) =>
        c.periodo === periodo &&
        ctx.mapaSuscripciones.get(c.suscripcionId)?.moneda === moneda,
    )
    .reduce((t, c) => t + c.montoCentimos, 0);

  const fin = finDeMes(periodo);
  const egresoDesembolsos = ctx.prestamos
    .filter(
      (p) =>
        p.estado !== 'ANULADO' &&
        p.moneda === moneda &&
        p.fechaPrestamo >= periodo &&
        p.fechaPrestamo <= fin,
    )
    .reduce((t, p) => t + p.capitalCentimos, 0);

  const perdidas = ctx.prestamos
    .filter((p) => p.estado === 'INCOBRABLE' && p.moneda === moneda)
    .filter((p) => {
      const fecha = (p.fechaEstado ?? '').slice(0, 10);
      return fecha >= periodo && fecha <= fin;
    })
    .reduce(
      (t, p) =>
        t + Math.max(0, p.capitalCentimos - cobradoPrestamo(ctx, p.id)),
      0,
    );

  const ingresos = ingresoSuscripciones + ingresoPrestamos;
  const egresos = egresoCostos + egresoDesembolsos;
  const margenSuscripciones = ingresoSuscripciones - egresoCostos;
  const resultadoEconomico = margenSuscripciones + interesCobrado - perdidas;
  const capitalCalle = capitalEnLaCalle(ctx, moneda);
  const baseRentabilidad = egresoCostos + capitalCalle;

  return {
    periodo,
    moneda,
    ingresoSuscripcionesCentimos: ingresoSuscripciones,
    ingresoPrestamosCentimos: ingresoPrestamos,
    ingresosCentimos: ingresos,
    egresoCostosCentimos: egresoCostos,
    egresoDesembolsosCentimos: egresoDesembolsos,
    egresosCentimos: egresos,
    balanceCajaCentimos: ingresos - egresos,
    margenSuscripcionesCentimos: margenSuscripciones,
    interesCobradoCentimos: interesCobrado,
    perdidasIncobrablesCentimos: perdidas,
    resultadoEconomicoCentimos: resultadoEconomico,
    capitalEnLaCalleCentimos: capitalCalle,
    rentabilidadPorcentaje:
      baseRentabilidad > 0
        ? Math.round((resultadoEconomico / baseRentabilidad) * 10000) / 100
        : 0,
  };
}

export async function balanceMensual(
  db: BaseDatos,
  periodo: string = periodoActual(),
  moneda = 'PEN',
): Promise<BalanceMes> {
  const ctx = await cargarContexto(db);
  return calcularBalance(ctx, periodo, moneda);
}

export async function serieBalance(
  db: BaseDatos,
  periodoFinal: string = periodoActual(),
  moneda = 'PEN',
  cantidad = 12,
): Promise<BalanceMes[]> {
  const ctx = await cargarContexto(db);
  return serieMeses(periodoFinal, cantidad).map((periodo) =>
    calcularBalance(ctx, periodo, moneda),
  );
}

/* ------------------------- Indicadores y alertas ------------------------- */

export interface IndicadoresDashboard {
  exigibleSuscripcionesCentimos: number;
  exigiblePrestamosCentimos: number;
  exigibleTotalCentimos: number;
  cobradoMesCentimos: number;
  porcentajeCobranza: number;
  totalVencidoCentimos: number;
  capitalEnLaCalleCentimos: number;
}

function exigibleSuscripciones(
  ctx: ContextoReportes,
  periodo: string,
  moneda: string,
): number {
  return ctx.cargos
    .filter((c) => c.periodo === periodo && c.estado !== 'ANULADO')
    .filter(
      (c) =>
        ctx.mapaSuscripciones.get(
          ctx.mapaMiembros.get(c.miembroId)?.suscripcionId ?? '',
        )?.moneda === moneda,
    )
    .reduce(
      (t, c) => t + Math.max(0, c.montoCentimos - pagadoCargo(ctx, c.id)),
      0,
    );
}

function exigiblePrestamos(
  ctx: ContextoReportes,
  periodo: string,
  moneda: string,
): { total: number; detalle: Array<{ prestamo: Prestamo; saldoAnterior: number; cuotaMes: number; exigible: number }> } {
  const fin = finDeMes(periodo);
  const detalle: Array<{
    prestamo: Prestamo;
    saldoAnterior: number;
    cuotaMes: number;
    exigible: number;
  }> = [];
  let total = 0;
  for (const prestamo of ctx.prestamos) {
    if (prestamo.estado !== 'ACTIVO' || prestamo.moneda !== moneda) continue;
    let saldoAnterior = 0;
    let cuotaMes = 0;
    for (const cuota of ctx.cuotas) {
      if (cuota.prestamoId !== prestamo.id) continue;
      const saldo = Math.max(
        0,
        cuota.montoProgramadoCentimos - pagadoCuota(ctx, cuota.id),
      );
      if (saldo <= 0) continue;
      if (cuota.fechaVencimiento < periodo) saldoAnterior += saldo;
      else if (cuota.fechaVencimiento <= fin) cuotaMes += saldo;
    }
    const exigible = prestamo.estrictoCumplimiento
      ? saldoAnterior + cuotaMes
      : cuotaMes;
    detalle.push({ prestamo, saldoAnterior, cuotaMes, exigible });
    total += exigible;
  }
  return { total, detalle };
}

function totalVencido(ctx: ContextoReportes, moneda: string): number {
  let total = 0;
  for (const cargo of ctx.cargos) {
    if (cargo.estado === 'ANULADO') continue;
    const suscripcion = ctx.mapaSuscripciones.get(
      ctx.mapaMiembros.get(cargo.miembroId)?.suscripcionId ?? '',
    );
    if (suscripcion?.moneda !== moneda) continue;
    const saldo = Math.max(
      0,
      cargo.montoCentimos - pagadoCargo(ctx, cargo.id),
    );
    if (saldo > 0 && cargo.fechaVencimiento < ctx.hoy) total += saldo;
  }
  for (const prestamo of ctx.prestamos) {
    if (prestamo.estado !== 'ACTIVO' || prestamo.moneda !== moneda) continue;
    for (const cuota of ctx.cuotas) {
      if (cuota.prestamoId !== prestamo.id) continue;
      const saldo = Math.max(
        0,
        cuota.montoProgramadoCentimos - pagadoCuota(ctx, cuota.id),
      );
      if (saldo > 0 && cuota.fechaVencimiento < ctx.hoy) total += saldo;
    }
  }
  return total;
}

export interface AlertasDashboard {
  suscripcionesEnPerdida: Array<{
    suscripcionId: string;
    nombre: string;
    margenRealCentimos: number;
    causa: string;
    alerta: boolean;
  }>;
  prestamosEnRiesgo: Array<{
    prestamoId: string;
    persona: string;
    saldoVencidoCentimos: number;
    diasMaxAtraso: number;
    marca: string;
  }>;
  cuotasPorVencer: Array<{
    cuotaId: string;
    persona: string;
    fechaVencimiento: string;
    saldoCentimos: number;
  }>;
}

function calcularAlertas(
  ctx: ContextoReportes,
  periodo: string,
  moneda: string,
): AlertasDashboard {
  const suscripcionesEnPerdida: AlertasDashboard['suscripcionesEnPerdida'] = [];
  for (const costo of ctx.costos) {
    if (costo.periodo !== periodo) continue;
    const suscripcion = ctx.mapaSuscripciones.get(costo.suscripcionId);
    if (!suscripcion || suscripcion.moneda !== moneda) continue;
    let cobrado = 0;
    for (const cargo of ctx.cargos) {
      if (cargo.periodo !== periodo || cargo.estado === 'ANULADO') continue;
      const miembro = ctx.mapaMiembros.get(cargo.miembroId);
      if (miembro?.suscripcionId !== suscripcion.id) continue;
      cobrado += pagadoCargo(ctx, cargo.id);
    }
    const margen = cobrado - costo.montoCentimos;
    if (margen < 0) {
      suscripcionesEnPerdida.push({
        suscripcionId: suscripcion.id,
        nombre: suscripcion.nombre,
        margenRealCentimos: margen,
        causa: cobrado < costo.montoCentimos ? 'PÉRDIDA' : '',
        alerta: !suscripcion.esUsoPersonal,
      });
    }
  }

  const prestamosEnRiesgo: AlertasDashboard['prestamosEnRiesgo'] = [];
  for (const prestamo of ctx.prestamos) {
    if (prestamo.estado !== 'ACTIVO' || prestamo.moneda !== moneda) continue;
    let saldoVencido = 0;
    let diasMax = 0;
    for (const cuota of ctx.cuotas) {
      if (cuota.prestamoId !== prestamo.id) continue;
      const saldo = Math.max(
        0,
        cuota.montoProgramadoCentimos - pagadoCuota(ctx, cuota.id),
      );
      if (saldo > 0 && cuota.fechaVencimiento < ctx.hoy) {
        saldoVencido += saldo;
        diasMax = Math.max(diasMax, diasEntre(cuota.fechaVencimiento, ctx.hoy));
      }
    }
    if (saldoVencido > 0 && diasMax > ctx.umbralRiesgo) {
      const persona = ctx.mapaPersonas.get(prestamo.personaId);
      prestamosEnRiesgo.push({
        prestamoId: prestamo.id,
        persona: persona
          ? `${persona.apellidos}, ${persona.nombres}`
          : '—',
        saldoVencidoCentimos: saldoVencido,
        diasMaxAtraso: diasMax,
        marca: 'EN_RIESGO',
      });
    }
  }

  const limite = sumarDias(ctx.hoy, 7);
  const cuotasPorVencer: AlertasDashboard['cuotasPorVencer'] = [];
  for (const prestamo of ctx.prestamos) {
    if (prestamo.estado !== 'ACTIVO' || prestamo.moneda !== moneda) continue;
    const persona = ctx.mapaPersonas.get(prestamo.personaId);
    for (const cuota of ctx.cuotas) {
      if (cuota.prestamoId !== prestamo.id) continue;
      const saldo = Math.max(
        0,
        cuota.montoProgramadoCentimos - pagadoCuota(ctx, cuota.id),
      );
      if (
        saldo > 0 &&
        cuota.fechaVencimiento >= ctx.hoy &&
        cuota.fechaVencimiento <= limite
      ) {
        cuotasPorVencer.push({
          cuotaId: cuota.id,
          persona: persona
            ? `${persona.apellidos}, ${persona.nombres}`
            : '—',
          fechaVencimiento: cuota.fechaVencimiento,
          saldoCentimos: saldo,
        });
      }
    }
  }

  return { suscripcionesEnPerdida, prestamosEnRiesgo, cuotasPorVencer };
}

export interface Dashboard {
  balance: BalanceMes;
  serie: BalanceMes[];
  indicadores: IndicadoresDashboard;
  alertas: AlertasDashboard;
}

export async function dashboard(
  db: BaseDatos,
  periodo: string = periodoActual(),
  moneda = 'PEN',
): Promise<Dashboard> {
  const ctx = await cargarContexto(db);
  const balance = calcularBalance(ctx, periodo, moneda);
  const serie = serieMeses(periodo, 12).map((p) =>
    calcularBalance(ctx, p, moneda),
  );
  const exigibleSubs = exigibleSuscripciones(ctx, periodo, moneda);
  const exigiblePrest = exigiblePrestamos(ctx, periodo, moneda).total;
  const cobradoMes = aplicacionesEnPeriodo(ctx, periodo, moneda).reduce(
    (t, a) => t + a.montoAplicadoCentimos,
    0,
  );
  const exigibleTotal = exigibleSubs + exigiblePrest;

  return {
    balance,
    serie,
    indicadores: {
      exigibleSuscripcionesCentimos: exigibleSubs,
      exigiblePrestamosCentimos: exigiblePrest,
      exigibleTotalCentimos: exigibleTotal,
      cobradoMesCentimos: cobradoMes,
      porcentajeCobranza:
        exigibleTotal > 0
          ? Math.round((cobradoMes / exigibleTotal) * 10000) / 100
          : 0,
      totalVencidoCentimos: totalVencido(ctx, moneda),
      capitalEnLaCalleCentimos: capitalEnLaCalle(ctx, moneda),
    },
    alertas: calcularAlertas(ctx, periodo, moneda),
  };
}

export const DEFINICIONES: Record<string, string> = {
  balanceCaja:
    'Ingresos cobrados en el mes menos costos de suscripciones y capital desembolsado. Un préstamo nuevo puede dejar la caja negativa sin ser pérdida.',
  resultadoEconomico:
    'Margen real de suscripciones + interés cobrado − pérdidas por incobrables registradas en el mes.',
  margenSuscripciones:
    'Cobrado de suscripciones en el mes menos los costos de las suscripciones del periodo.',
  capitalEnLaCalle:
    'Capital de préstamos activos que todavía no se recuperó.',
  exigible:
    'Suscripciones del periodo más la cuota del mes de los préstamos; en préstamos estrictos incluye lo vencido.',
  porcentajeCobranza: 'Cobrado del mes dividido entre el exigible del mes.',
  rentabilidad:
    'Resultado económico dividido entre costos de suscripciones más capital en la calle al cierre.',
};

export function mesesDelAnio(periodo: string): string[] {
  return serieMeses(periodo, 12);
}

export function periodoAnteriorA(periodo: string): string {
  return sumarMeses(periodo, -1);
}

/* ------------------------------- CU-18 ------------------------------- */

export interface MiembroDetalleLinea {
  personaId: string;
  nombre: string;
  montoCentimos: number;
  pagadoCentimos: number;
  saldoCentimos: number;
  costoPorPlazaCentimos: number;
  aportaMenosQueCosto: boolean;
}

export interface LineaSuscripcion {
  suscripcionId: string;
  nombre: string;
  plataforma: string;
  moneda: string;
  periodo: string;
  costoCentimos: number;
  esperadoCentimos: number;
  cobradoCentimos: number;
  margenRealCentimos: number;
  margenProyectadoCentimos: number;
  causaPerdida: CausaPerdida;
  alerta: boolean;
  esUsoPersonal: boolean;
  miembros: MiembroDetalleLinea[];
}

function lineaSuscripcion(
  ctx: ContextoReportes,
  costo: CostoSuscripcionPeriodo,
): LineaSuscripcion | null {
  const suscripcion = ctx.mapaSuscripciones.get(costo.suscripcionId);
  if (!suscripcion) return null;
  const plataforma =
    ctx.plataformas.find((p) => p.id === suscripcion.plataformaId)?.nombre ??
    '—';
  const costoPorPlaza = Math.round(
    costo.montoCentimos / Math.max(1, suscripcion.capacidad),
  );

  const cargos = ctx.cargos.filter(
    (c) => c.periodo === costo.periodo && c.estado !== 'ANULADO',
  );
  const miembros: MiembroDetalleLinea[] = [];
  let esperado = 0;
  let cobrado = 0;

  for (const cargo of cargos) {
    const miembro = ctx.mapaMiembros.get(cargo.miembroId);
    if (!miembro || miembro.suscripcionId !== suscripcion.id) continue;
    const persona = ctx.mapaPersonas.get(miembro.personaId);
    const pagado = pagadoCargo(ctx, cargo.id);
    esperado += cargo.montoCentimos;
    cobrado += pagado;
    miembros.push({
      personaId: miembro.personaId,
      nombre: persona
        ? `${persona.apellidos}, ${persona.nombres}`
        : '—',
      montoCentimos: cargo.montoCentimos,
      pagadoCentimos: pagado,
      saldoCentimos: Math.max(0, cargo.montoCentimos - pagado),
      costoPorPlazaCentimos: costoPorPlaza,
      aportaMenosQueCosto: cargo.montoCentimos < costoPorPlaza,
    });
  }
  miembros.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  let causa: CausaPerdida = null;
  if (cobrado < costo.montoCentimos) {
    if (esperado < costo.montoCentimos && cobrado < esperado) {
      causa = 'AMBAS';
    } else if (esperado < costo.montoCentimos) {
      causa = 'TARIFA';
    } else {
      causa = 'MOROSIDAD';
    }
  }

  return {
    suscripcionId: suscripcion.id,
    nombre: suscripcion.nombre,
    plataforma,
    moneda: suscripcion.moneda,
    periodo: costo.periodo,
    costoCentimos: costo.montoCentimos,
    esperadoCentimos: esperado,
    cobradoCentimos: cobrado,
    margenRealCentimos: cobrado - costo.montoCentimos,
    margenProyectadoCentimos: esperado - costo.montoCentimos,
    causaPerdida: causa,
    alerta: causa !== null && !suscripcion.esUsoPersonal,
    esUsoPersonal: suscripcion.esUsoPersonal,
    miembros,
  };
}

export async function informeSuscripciones(
  db: BaseDatos,
  periodo: string = periodoActual(),
  moneda = 'PEN',
): Promise<LineaSuscripcion[]> {
  const ctx = await cargarContexto(db);
  return ctx.costos
    .filter(
      (c) =>
        c.periodo === periodo &&
        ctx.mapaSuscripciones.get(c.suscripcionId)?.moneda === moneda,
    )
    .map((costo) => lineaSuscripcion(ctx, costo))
    .filter((linea): linea is LineaSuscripcion => linea !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Solo las que pierden y no son de uso personal. */
export async function informePerdidasSuscripciones(
  db: BaseDatos,
  periodo: string = periodoActual(),
  moneda = 'PEN',
): Promise<LineaSuscripcion[]> {
  const lineas = await informeSuscripciones(db, periodo, moneda);
  return lineas.filter((linea) => linea.alerta && linea.causaPerdida !== null);
}

/* ------------------------------- CSV --------------------------------- */

export type FilaCsv = Record<string, string | number | null>;

export function aCsv(filas: FilaCsv[]): string {
  if (filas.length === 0) return '';
  const columnas = Object.keys(filas[0]);
  const escapar = (valor: string | number | null | undefined) =>
    `"${String(valor ?? '').replace(/"/g, '""')}"`;
  return [
    columnas.map(escapar).join(','),
    ...filas.map((fila) =>
      columnas.map((columna) => escapar(fila[columna])).join(','),
    ),
  ].join('\r\n');
}

export function suscripcionesACsv(lineas: LineaSuscripcion[]): string {
  return aCsv(
    lineas.map((linea) => ({
      suscripcion: linea.nombre,
      plataforma: linea.plataforma,
      moneda: linea.moneda,
      periodo: linea.periodo,
      costo: (linea.costoCentimos / 100).toFixed(2),
      esperado: (linea.esperadoCentimos / 100).toFixed(2),
      cobrado: (linea.cobradoCentimos / 100).toFixed(2),
      margen_real: (linea.margenRealCentimos / 100).toFixed(2),
      margen_proyectado: (linea.margenProyectadoCentimos / 100).toFixed(2),
      causa_perdida: linea.causaPerdida ?? '',
    })),
  );
}
