import type { AplicacionPago, Pago } from './modelo';

export interface AuxiliaresSaldos {
  pagosRegistrados: Set<string>;
  aplicaciones: AplicacionPago[];
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
