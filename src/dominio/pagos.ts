import type {
  EstadoCargo,
  EstadoCuota,
  ObligacionPendiente,
  TipoObligacion,
} from './modelo';
import {
  ErrorNoEncontrado,
  ErrorReglaNegocio,
  ErrorValidacion,
} from './errores';

export interface SolicitudAplicacion {
  tipo: TipoObligacion;
  obligacionId: string;
  montoCentimos: number;
}

export interface AplicacionPlanificada {
  obligacion: ObligacionPendiente;
  montoCentimos: number;
}

/**
 * Regla pura de aplicación de pagos: valida el reparto solicitado o propone
 * uno por antigüedad (lo más vencido primero). No conoce IndexedDB.
 */
export function planificarAplicaciones(
  obligaciones: ObligacionPendiente[],
  moneda: string,
  montoCentimos: number,
  solicitadas?: SolicitudAplicacion[],
): AplicacionPlanificada[] {
  const porId = new Map(obligaciones.map((o) => [o.id, o]));
  const plan: AplicacionPlanificada[] = [];

  if (solicitadas && solicitadas.length > 0) {
    const acumulado = new Map<string, number>();
    for (const solicitada of solicitadas) {
      const obligacion = porId.get(solicitada.obligacionId);
      if (!obligacion) {
        throw new ErrorNoEncontrado(
          'La obligación no existe o ya está pagada.',
        );
      }
      if (obligacion.tipo !== solicitada.tipo) {
        throw new ErrorValidacion(
          'El tipo de la obligación no coincide.',
          'aplicaciones',
        );
      }
      if (obligacion.moneda !== moneda) {
        throw new ErrorValidacion(
          'La moneda del pago no coincide con la obligación.',
          'moneda',
        );
      }
      if (solicitada.montoCentimos <= 0) {
        throw new ErrorValidacion(
          'Cada aplicación debe ser mayor que cero.',
          'aplicaciones',
        );
      }
      acumulado.set(
        obligacion.id,
        (acumulado.get(obligacion.id) ?? 0) + solicitada.montoCentimos,
      );
    }

    for (const [id, total] of acumulado) {
      const obligacion = porId.get(id)!;
      if (total > obligacion.saldoCentimos) {
        throw new ErrorReglaNegocio(
          `La aplicación supera el saldo de "${obligacion.concepto}".`,
        );
      }
    }

    const suma = [...acumulado.values()].reduce((a, b) => a + b, 0);
    if (suma > montoCentimos) {
      throw new ErrorReglaNegocio(
        'La suma de aplicaciones supera el monto del pago.',
      );
    }

    for (const [id, total] of acumulado) {
      plan.push({ obligacion: porId.get(id)!, montoCentimos: total });
    }
    return plan;
  }

  let restante = montoCentimos;
  for (const obligacion of obligaciones) {
    if (restante <= 0) break;
    if (obligacion.moneda !== moneda) continue;
    const aplicar = Math.min(obligacion.saldoCentimos, restante);
    if (aplicar <= 0) continue;
    plan.push({ obligacion, montoCentimos: aplicar });
    restante -= aplicar;
  }

  if (
    plan.length === 0 &&
    obligaciones.length > 0 &&
    !obligaciones.some((o) => o.moneda === moneda)
  ) {
    throw new ErrorValidacion(
      'La moneda del pago no coincide con la de las obligaciones.',
      'moneda',
    );
  }

  return plan;
}

/** Estado que corresponde a un cargo o cuota después de aplicar pagos. */
export function estadoDeObligacion(
  tipo: 'SUSCRIPCION',
  montoCentimos: number,
  pagadoCentimos: number,
): EstadoCargo;
export function estadoDeObligacion(
  tipo: 'PRESTAMO',
  montoCentimos: number,
  pagadoCentimos: number,
): EstadoCuota;
export function estadoDeObligacion(
  tipo: TipoObligacion,
  montoCentimos: number,
  pagadoCentimos: number,
): EstadoCargo | EstadoCuota;
export function estadoDeObligacion(
  tipo: TipoObligacion,
  montoCentimos: number,
  pagadoCentimos: number,
): EstadoCargo | EstadoCuota {
  const saldo = Math.max(0, montoCentimos - pagadoCentimos);
  if (saldo <= 0) return tipo === 'PRESTAMO' ? 'PAGADA' : 'PAGADO';
  return pagadoCentimos > 0 ? 'PARCIAL' : 'PENDIENTE';
}

export function totalAplicado(
  aplicaciones: AplicacionPlanificada[],
): number {
  return aplicaciones.reduce((total, a) => total + a.montoCentimos, 0);
}
