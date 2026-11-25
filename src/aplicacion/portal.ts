import type { BaseDatos } from '../db/baseDatos';
import type {
  EstadoCargo,
  EstadoCuota,
  Pago,
  Persona,
  Prestamo,
} from '../db/tipos';
import { ErrorNoEncontrado } from '../dominio/errores';
import { cargarAuxiliaresSaldos, pagadoDeCargo, pagadoDeCuota } from './saldos';

export interface CargoVista {
  id: string;
  periodo: string;
  fechaVencimiento: string;
  montoCentimos: number;
  pagadoCentimos: number;
  saldoCentimos: number;
  estado: EstadoCargo;
}

export interface SuscripcionVista {
  id: string;
  nombre: string;
  moneda: string;
  estado: string;
  montoAcordadoCentimos: number;
  esPlazaPropia: boolean;
  saldoCentimos: number;
  cargos: CargoVista[];
}

export interface CuotaVista {
  id: string;
  numeroCuota: number;
  fechaVencimiento: string;
  montoCentimos: number;
  pagadoCentimos: number;
  saldoCentimos: number;
  estado: EstadoCuota;
}

export interface PrestamoVista {
  id: string;
  moneda: string;
  capitalCentimos: number;
  plazoMeses: number;
  tasaMensual: number;
  estado: Prestamo['estado'];
  saldoCentimos: number;
  cuotas: CuotaVista[];
}

export interface VistaPersona {
  persona: Persona;
  suscripciones: SuscripcionVista[];
  prestamos: PrestamoVista[];
  pagos: Pago[];
  deudaPorMoneda: Array<{ moneda: string; centimos: number }>;
  /** La vista local es siempre de solo lectura. */
  puedeEditar: false;
}

/**
 * CU-22 adaptado a una PWA sin servidor: muestra únicamente la información de
 * la persona elegida y no expone acciones de escritura. Las consultas por
 * identificadores ajenos se comportan como inexistentes (ver CU-16).
 */
export async function consultarVistaPersona(
  db: BaseDatos,
  personaId: string,
): Promise<VistaPersona> {
  const persona = await db.personas.get(personaId);
  if (!persona) throw new ErrorNoEncontrado('La persona no existe.');

  const aux = await cargarAuxiliaresSaldos(db);
  const deuda = new Map<string, number>();
  const suscripciones: SuscripcionVista[] = [];
  const prestamos: PrestamoVista[] = [];

  const miembros = await db.miembrosSuscripcion
    .where('personaId')
    .equals(personaId)
    .toArray();

  for (const miembro of miembros) {
    const suscripcion = await db.suscripciones.get(miembro.suscripcionId);
    if (!suscripcion) continue;
    const cargos = await db.cargosSuscripcion
      .where('miembroId')
      .equals(miembro.id)
      .toArray();
    const cargosVista: CargoVista[] = cargos
      .sort((a, b) => b.periodo.localeCompare(a.periodo))
      .map((cargo) => {
        const pagado = pagadoDeCargo(aux, cargo.id);
        const saldo = Math.max(0, cargo.montoCentimos - pagado);
        return {
          id: cargo.id,
          periodo: cargo.periodo,
          fechaVencimiento: cargo.fechaVencimiento,
          montoCentimos: cargo.montoCentimos,
          pagadoCentimos: pagado,
          saldoCentimos: saldo,
          estado: cargo.estado,
        };
      });
    const saldo = cargosVista.reduce((t, c) => t + c.saldoCentimos, 0);
    if (saldo > 0) {
      deuda.set(
        suscripcion.moneda,
        (deuda.get(suscripcion.moneda) ?? 0) + saldo,
      );
    }
    suscripciones.push({
      id: suscripcion.id,
      nombre: suscripcion.nombre,
      moneda: suscripcion.moneda,
      estado: suscripcion.estado,
      montoAcordadoCentimos: miembro.montoAcordadoCentimos,
      esPlazaPropia: miembro.esPlazaPropia,
      saldoCentimos: saldo,
      cargos: cargosVista,
    });
  }

  const prestamosDb = await db.prestamos
    .where('personaId')
    .equals(personaId)
    .toArray();
  for (const prestamo of prestamosDb) {
    const cuotas = await db.cuotasPrestamo
      .where('prestamoId')
      .equals(prestamo.id)
      .toArray();
    const cuotasVista: CuotaVista[] = cuotas
      .sort((a, b) => a.numeroCuota - b.numeroCuota)
      .map((cuota) => {
        const pagado = pagadoDeCuota(aux, cuota.id);
        return {
          id: cuota.id,
          numeroCuota: cuota.numeroCuota,
          fechaVencimiento: cuota.fechaVencimiento,
          montoCentimos: cuota.montoProgramadoCentimos,
          pagadoCentimos: pagado,
          saldoCentimos: Math.max(
            0,
            cuota.montoProgramadoCentimos - pagado,
          ),
          estado: cuota.estado,
        };
      });
    const saldo = cuotasVista.reduce((t, c) => t + c.saldoCentimos, 0);
    if (saldo > 0 && prestamo.estado !== 'ANULADO') {
      deuda.set(
        prestamo.moneda,
        (deuda.get(prestamo.moneda) ?? 0) + saldo,
      );
    }
    prestamos.push({
      id: prestamo.id,
      moneda: prestamo.moneda,
      capitalCentimos: prestamo.capitalCentimos,
      plazoMeses: prestamo.plazoMeses,
      tasaMensual: prestamo.tasaMensual,
      estado: prestamo.estado,
      saldoCentimos: saldo,
      cuotas: cuotasVista,
    });
  }

  const pagos = await db.pagos.where('personaId').equals(personaId).toArray();

  return {
    persona,
    suscripciones: suscripciones.sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    ),
    prestamos,
    pagos: pagos.sort((a, b) => b.fechaPago.localeCompare(a.fechaPago)),
    deudaPorMoneda: [...deuda.entries()].map(([moneda, centimos]) => ({
      moneda,
      centimos,
    })),
    puedeEditar: false,
  };
}
