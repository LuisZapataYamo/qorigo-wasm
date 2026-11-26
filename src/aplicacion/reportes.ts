import type { DatosQoriGo } from './puertos/persistencia';
import { cargarAuxiliaresSaldos } from './saldos';
import type {
  ContextoReportes,
  Dashboard,
  InformeRentabilidad,
  LineaPrestamo,
  LineaSuscripcion,
  BalanceMes,
  Cobranza,
} from '../dominio/informes';
import {
  calcularBalance,
  calcularCobranza,
  calcularDashboard,
  calcularInformePrestamos,
  calcularInformeSuscripciones,
  calcularRentabilidad,
} from '../dominio/informes';
import { hoy, periodoActual, serieMeses } from '../dominio/fechas';

/** Carga una foto coherente de los datos para los informes. */
export async function cargarContexto(
  db: DatosQoriGo,
): Promise<ContextoReportes> {
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

export async function balanceMensual(
  db: DatosQoriGo,
  periodo: string = periodoActual(),
  moneda = 'PEN',
): Promise<BalanceMes> {
  const ctx = await cargarContexto(db);
  return calcularBalance(ctx, periodo, moneda);
}

export async function serieBalance(
  db: DatosQoriGo,
  periodoFinal: string = periodoActual(),
  moneda = 'PEN',
  cantidad = 12,
): Promise<BalanceMes[]> {
  const ctx = await cargarContexto(db);
  return serieMeses(periodoFinal, cantidad).map((periodo) =>
    calcularBalance(ctx, periodo, moneda),
  );
}

export async function dashboard(
  db: DatosQoriGo,
  periodo: string = periodoActual(),
  moneda = 'PEN',
): Promise<Dashboard> {
  const ctx = await cargarContexto(db);
  return calcularDashboard(ctx, periodo, moneda);
}

export async function informeSuscripciones(
  db: DatosQoriGo,
  periodo: string = periodoActual(),
  moneda = 'PEN',
): Promise<LineaSuscripcion[]> {
  const ctx = await cargarContexto(db);
  return calcularInformeSuscripciones(ctx, periodo, moneda);
}

export async function informePerdidasSuscripciones(
  db: DatosQoriGo,
  periodo: string = periodoActual(),
  moneda = 'PEN',
): Promise<LineaSuscripcion[]> {
  const lineas = await informeSuscripciones(db, periodo, moneda);
  return lineas.filter((linea) => linea.alerta && linea.causaPerdida !== null);
}

export async function informePrestamos(
  db: DatosQoriGo,
  moneda?: string,
): Promise<LineaPrestamo[]> {
  const ctx = await cargarContexto(db);
  return calcularInformePrestamos(ctx, moneda);
}

export async function rentabilidad(
  db: DatosQoriGo,
  periodo: string = periodoActual(),
  moneda = 'PEN',
): Promise<InformeRentabilidad> {
  const ctx = await cargarContexto(db);
  return calcularRentabilidad(ctx, periodo, moneda);
}

export async function cobranza(
  db: DatosQoriGo,
  periodo: string = periodoActual(),
  moneda = 'PEN',
): Promise<Cobranza> {
  const ctx = await cargarContexto(db);
  return calcularCobranza(ctx, periodo, moneda);
}

export {
  aCsv,
  cobranzaACsv,
  DEFINICIONES,
  mesesDelAnio,
  periodoAnteriorA,
  prestamosACsv,
  rentabilidadACsv,
  suscripcionesACsv,
  type AlertasDashboard,
  type Cobranza,
  type ContextoReportes,
  type Dashboard,
  type DetalleExigiblePrestamo,
  type FilaCsv,
  type IndicadoresDashboard,
  type InformeRentabilidad,
  type LineaPrestamo,
  type LineaRentabilidad,
  type LineaSuscripcion,
  type MiembroDetalleLinea,
  type Moroso,
  type ObligacionVencida,
  type TramoAntiguedad,
} from '../dominio/informes';
