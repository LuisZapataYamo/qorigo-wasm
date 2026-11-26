import type { AplicacionPago, Pago } from '../dominio/modelo';
import type { DatosQoriGo } from './puertos/persistencia';

export interface AuxiliaresSaldos {
  pagosRegistrados: Set<string>;
  aplicaciones: AplicacionPago[];
}

/** Carga una sola vez los pagos válidos y sus aplicaciones. */
export async function cargarAuxiliaresSaldos(
  db: DatosQoriGo,
): Promise<AuxiliaresSaldos> {
  const [pagos, aplicaciones] = await Promise.all([
    db.pagos.toArray(),
    db.aplicacionesPago.toArray(),
  ]);
  return {
    pagosRegistrados: new Set(
      pagos.filter((p) => p.estado === 'REGISTRADO').map((p) => p.id),
    ),
    aplicaciones,
  };
}

export function aplicacionesDeCargo(
  aux: AuxiliaresSaldos,
  cargoId: string,
): AplicacionPago[] {
  return aux.aplicaciones.filter(
    (a) => a.cargoId === cargoId && aux.pagosRegistrados.has(a.pagoId),
  );
}

export function aplicacionesDeCuota(
  aux: AuxiliaresSaldos,
  cuotaId: string,
): AplicacionPago[] {
  return aux.aplicaciones.filter(
    (a) => a.cuotaId === cuotaId && aux.pagosRegistrados.has(a.pagoId),
  );
}

export function pagadoDeCargo(
  aux: AuxiliaresSaldos,
  cargoId: string,
): number {
  return aplicacionesDeCargo(aux, cargoId).reduce(
    (total, a) => total + a.montoAplicadoCentimos,
    0,
  );
}

export function pagadoDeCuota(
  aux: AuxiliaresSaldos,
  cuotaId: string,
): number {
  return aplicacionesDeCuota(aux, cuotaId).reduce(
    (total, a) => total + a.montoAplicadoCentimos,
    0,
  );
}

export function esPagoValido(pago: Pago | undefined): boolean {
  return pago?.estado === 'REGISTRADO';
}
