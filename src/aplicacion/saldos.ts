import type { DatosQoriGo } from './puertos/persistencia';
import type { AuxiliaresSaldos } from '../dominio/saldos';

export type { AuxiliaresSaldos } from '../dominio/saldos';
export {
  aplicacionesDeCargo,
  aplicacionesDeCuota,
  esPagoValido,
  pagadoDeCargo,
  pagadoDeCuota,
} from '../dominio/saldos';

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
