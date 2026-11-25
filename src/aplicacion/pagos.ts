import type { BaseDatos } from '../db/baseDatos';
import type {
  AplicacionPago,
  ComprobantePago,
  ObligacionPendiente,
  Pago,
  TipoObligacion,
} from '../db/tipos';
import { auditar } from '../db/auditoria';
import { aCentimos } from '../dominio/dinero';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorReglaNegocio,
  ErrorValidacion,
} from '../dominio/errores';
import { esFechaValida, etiquetaPeriodo } from '../dominio/fechas';
import { nuevoId } from '../dominio/ids';
import { repartirCapitalInteres } from './prestamos';
import { cargarAuxiliaresSaldos, pagadoDeCargo, pagadoDeCuota } from './saldos';

export interface ComprobanteProcesado {
  imagen: Blob;
  mimeType: string;
  ancho: number;
  alto: number;
  sha256: string;
}

export interface AplicacionSolicitada {
  tipo: TipoObligacion;
  obligacionId: string;
  monto: number | string;
}

export interface EntradaPago {
  personaId: string;
  moneda: string;
  fechaPago: string;
  monto: number | string;
  metodoPago: string;
  referencia?: string;
  observacion?: string;
  aplicaciones?: AplicacionSolicitada[];
  comprobantes?: ComprobanteProcesado[];
}

export interface ResultadoPago {
  pago: Pago;
  aplicaciones: AplicacionPago[];
  remanenteCentimos: number;
  obligaciones: ObligacionPendiente[];
}

export interface OpcionesRegistroPago {
  alInsertarComprobante?: (indice: number) => void | Promise<void>;
  /** Confirma el aviso de comprobante duplicado (mismo sha256). */
  confirmarDuplicado?: boolean;
}

/**
 * Devuelve las obligaciones con saldo de una persona, las vencidas primero.
 * La moneda se toma de la suscripción o del préstamo, nunca del pago.
 */
export async function obtenerObligacionesPendientes(
  db: BaseDatos,
  personaId: string,
  tipo?: TipoObligacion,
): Promise<ObligacionPendiente[]> {
  const aux = await cargarAuxiliaresSaldos(db);
  const resultado: ObligacionPendiente[] = [];

  if (!tipo || tipo === 'SUSCRIPCION') {
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
      for (const cargo of cargos) {
        if (cargo.estado === 'ANULADO') continue;
        const pagado = pagadoDeCargo(aux, cargo.id);
        const saldo = Math.max(0, cargo.montoCentimos - pagado);
        if (saldo <= 0) continue;
        resultado.push({
          tipo: 'SUSCRIPCION',
          id: cargo.id,
          personaId,
          moneda: suscripcion.moneda,
          concepto: `${suscripcion.nombre} · ${etiquetaPeriodo(cargo.periodo)}`,
          fechaVencimiento: cargo.fechaVencimiento,
          montoCentimos: cargo.montoCentimos,
          pagadoCentimos: pagado,
          saldoCentimos: saldo,
        });
      }
    }
  }

  if (!tipo || tipo === 'PRESTAMO') {
    const prestamos = await db.prestamos
      .where('personaId')
      .equals(personaId)
      .toArray();
    for (const prestamo of prestamos) {
      if (prestamo.estado !== 'ACTIVO') continue;
      const cuotas = await db.cuotasPrestamo
        .where('prestamoId')
        .equals(prestamo.id)
        .toArray();
      for (const cuota of cuotas) {
        const pagado = pagadoDeCuota(aux, cuota.id);
        const saldo = Math.max(0, cuota.montoProgramadoCentimos - pagado);
        if (saldo <= 0) continue;
        resultado.push({
          tipo: 'PRESTAMO',
          id: cuota.id,
          personaId,
          moneda: prestamo.moneda,
          concepto: `Cuota ${cuota.numeroCuota} de ${prestamo.plazoMeses}`,
          fechaVencimiento: cuota.fechaVencimiento,
          montoCentimos: cuota.montoProgramadoCentimos,
          pagadoCentimos: pagado,
          saldoCentimos: saldo,
          capitalCentimos: cuota.capitalProgramadoCentimos,
          interesCentimos: cuota.interesProgramadoCentimos,
        });
      }
    }
  }

  return resultado.sort((a, b) => {
    if (a.fechaVencimiento === b.fechaVencimiento) return 0;
    return a.fechaVencimiento < b.fechaVencimiento ? -1 : 1;
  });
}

/**
 * CU-12 / CU-13. Registra un pago, lo aplica por antigüedad (o según el
 * reparto indicado), actualiza estados y guarda comprobantes en una sola
 * transacción.
 */
export async function registrarPago(
  db: BaseDatos,
  entrada: EntradaPago,
  opciones: OpcionesRegistroPago = {},
): Promise<ResultadoPago> {
  const persona = await db.personas.get(entrada.personaId);
  if (!persona) throw new ErrorNoEncontrado('La persona no existe.');
  if (!(await db.monedas.get(entrada.moneda))) {
    throw new ErrorValidacion('La moneda no existe.', 'moneda');
  }
  if (!esFechaValida(entrada.fechaPago)) {
    throw new ErrorValidacion('La fecha de pago no es válida.', 'fechaPago');
  }
  const metodo = entrada.metodoPago?.trim() ?? '';
  if (!metodo) {
    throw new ErrorValidacion('El método de pago es obligatorio.', 'metodoPago');
  }
  const montoCentimos = aCentimos(entrada.monto);
  if (montoCentimos <= 0) {
    throw new ErrorValidacion('El monto debe ser mayor que cero.', 'monto');
  }

  const comprobantes = entrada.comprobantes ?? [];
  if (comprobantes.length > 3) {
    throw new ErrorValidacion(
      'Se permiten como máximo 3 comprobantes por pago.',
      'comprobantes',
    );
  }
  const configMetodos = (
    await db.configuracion.get('metodos_con_comprobante')
  )?.valor;
  const metodosConComprobante = (configMetodos ?? '')
    .split(',')
    .map((m) => m.trim().toUpperCase())
    .filter(Boolean);
  if (
    metodosConComprobante.includes(metodo.toUpperCase()) &&
    comprobantes.length === 0
  ) {
    throw new ErrorValidacion(
      `El método ${metodo} exige adjuntar un comprobante.`,
      'comprobantes',
    );
  }
  for (const comprobante of comprobantes) {
    const duplicado = await db.comprobantesPago
      .where('sha256')
      .equals(comprobante.sha256)
      .first();
    if (duplicado && !opciones.confirmarDuplicado) {
      throw new ErrorConflicto(
        'Ya existe un comprobante idéntico. Confirma si deseas registrarlo de todos modos.',
      );
    }
  }

  const obligaciones = await obtenerObligacionesPendientes(
    db,
    entrada.personaId,
  );
  const aux = await cargarAuxiliaresSaldos(db);
  const porId = new Map(obligaciones.map((o) => [o.id, o]));

  const aplicacionesCalculadas: Array<{
    obligacion: ObligacionPendiente;
    montoCentimos: number;
  }> = [];

  if (entrada.aplicaciones && entrada.aplicaciones.length > 0) {
    const acumulado = new Map<string, number>();
    for (const solicitada of entrada.aplicaciones) {
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
      if (obligacion.moneda !== entrada.moneda) {
        throw new ErrorValidacion(
          'La moneda del pago no coincide con la obligación.',
          'moneda',
        );
      }
      const monto = aCentimos(solicitada.monto);
      if (monto <= 0) {
        throw new ErrorValidacion(
          'Cada aplicación debe ser mayor que cero.',
          'aplicaciones',
        );
      }
      acumulado.set(
        obligacion.id,
        (acumulado.get(obligacion.id) ?? 0) + monto,
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
      aplicacionesCalculadas.push({
        obligacion: porId.get(id)!,
        montoCentimos: total,
      });
    }
  } else {
    let restante = montoCentimos;
    for (const obligacion of obligaciones) {
      if (restante <= 0) break;
      if (obligacion.moneda !== entrada.moneda) continue;
      const aplicar = Math.min(obligacion.saldoCentimos, restante);
      if (aplicar <= 0) continue;
      aplicacionesCalculadas.push({ obligacion, montoCentimos: aplicar });
      restante -= aplicar;
    }
  }

  const sumaAplicada = aplicacionesCalculadas.reduce(
    (total, a) => total + a.montoCentimos,
    0,
  );
  if (
    sumaAplicada === 0 &&
    obligaciones.length > 0 &&
    !obligaciones.some((o) => o.moneda === entrada.moneda)
  ) {
    throw new ErrorValidacion(
      'La moneda del pago no coincide con la de las obligaciones.',
      'moneda',
    );
  }
  if (sumaAplicada > montoCentimos) {
    throw new ErrorReglaNegocio(
      'La suma de aplicaciones supera el monto del pago.',
    );
  }

  const pago: Pago = {
    id: nuevoId(),
    personaId: entrada.personaId,
    moneda: entrada.moneda,
    fechaPago: entrada.fechaPago,
    montoCentimos,
    metodoPago: metodo,
    referencia: entrada.referencia?.trim() || undefined,
    observacion: entrada.observacion?.trim() || undefined,
    estado: 'REGISTRADO',
    creadoEn: new Date().toISOString(),
  };

  const aplicaciones: AplicacionPago[] = aplicacionesCalculadas.map(
    ({ obligacion, montoCentimos: monto }) => {
      if (obligacion.tipo === 'PRESTAMO') {
        const reparto = repartirCapitalInteres(
          monto,
          obligacion.capitalCentimos ?? 0,
          obligacion.interesCentimos ?? 0,
        );
        return {
          id: nuevoId(),
          pagoId: pago.id,
          cuotaId: obligacion.id,
          montoAplicadoCentimos: monto,
          montoCapitalCentimos: reparto.capital,
          montoInteresCentimos: reparto.interes,
        };
      }
      return {
        id: nuevoId(),
        pagoId: pago.id,
        cargoId: obligacion.id,
        montoAplicadoCentimos: monto,
      };
    },
  );

  const nuevosPorObligacion = new Map(
    aplicacionesCalculadas.map((a) => [a.obligacion.id, a.montoCentimos]),
  );

  await db.transaction(
    'rw',
    [
      db.pagos,
      db.aplicacionesPago,
      db.comprobantesPago,
      db.cargosSuscripcion,
      db.cuotasPrestamo,
      db.prestamos,
      db.auditoria,
    ],
    async () => {
      await db.pagos.add(pago);
      for (const aplicacion of aplicaciones) {
        await db.aplicacionesPago.add(aplicacion);
      }

      for (const comprobante of entrada.comprobantes ?? []) {
        const indice = (entrada.comprobantes ?? []).indexOf(comprobante);
        await opciones.alInsertarComprobante?.(indice);
        const registro: ComprobantePago = {
          id: nuevoId(),
          pagoId: pago.id,
          imagen: comprobante.imagen,
          mimeType: comprobante.mimeType,
          ancho: comprobante.ancho,
          alto: comprobante.alto,
          sha256: comprobante.sha256,
          subidoEn: new Date().toISOString(),
        };
        await db.comprobantesPago.add(registro);
      }

      for (const { obligacion } of aplicacionesCalculadas) {
        const pagado =
          obligacion.pagadoCentimos +
          (nuevosPorObligacion.get(obligacion.id) ?? 0);
        const saldo = Math.max(0, obligacion.montoCentimos - pagado);
        const estado =
          saldo <= 0
            ? obligacion.tipo === 'PRESTAMO'
              ? 'PAGADA'
              : 'PAGADO'
            : pagado > 0
              ? 'PARCIAL'
              : obligacion.tipo === 'PRESTAMO'
                ? 'PENDIENTE'
                : 'PENDIENTE';
        if (obligacion.tipo === 'PRESTAMO') {
          await db.cuotasPrestamo.update(obligacion.id, {
            estado: estado as 'PENDIENTE' | 'PARCIAL' | 'PAGADA',
          });
        } else {
          await db.cargosSuscripcion.update(obligacion.id, {
            estado: estado as 'PENDIENTE' | 'PARCIAL' | 'PAGADO',
          });
        }
      }

      const prestamosAfectados = new Set(
        aplicacionesCalculadas
          .filter((a) => a.obligacion.tipo === 'PRESTAMO')
          .map((a) => a.obligacion.id),
      );
      if (prestamosAfectados.size > 0) {
        const cuotasAfectadas = await db.cuotasPrestamo
          .where('id')
          .anyOf([...prestamosAfectados])
          .toArray();
        const idsPrestamos = new Set(
          cuotasAfectadas.map((c) => c.prestamoId),
        );
        for (const prestamoId of idsPrestamos) {
          const prestamo = await db.prestamos.get(prestamoId);
          if (!prestamo || prestamo.estado !== 'ACTIVO') continue;
          const cuotas = await db.cuotasPrestamo
            .where('prestamoId')
            .equals(prestamoId)
            .toArray();
          const todasPagadas = cuotas.every((cuota) => {
            const pagado =
              pagadoDeCuota(aux, cuota.id) +
              (nuevosPorObligacion.get(cuota.id) ?? 0);
            return pagado >= cuota.montoProgramadoCentimos;
          });
          if (todasPagadas) {
            await db.prestamos.update(prestamoId, {
              estado: 'CANCELADO',
              fechaEstado: new Date().toISOString(),
            });
          }
        }
      }

      await auditar(db, {
        entidad: 'PAGO',
        entidadId: pago.id,
        accion: 'CREAR',
        despues: {
          pago,
          aplicaciones: aplicaciones.length,
          remanenteCentimos: montoCentimos - sumaAplicada,
        },
      });
    },
  );

  return {
    pago,
    aplicaciones,
    remanenteCentimos: montoCentimos - sumaAplicada,
    obligaciones,
  };
}

export interface FiltroPagos {
  personaId?: string;
  estado?: 'REGISTRADO' | 'ANULADO';
  metodoPago?: string;
  tipo?: TipoObligacion;
  desde?: string;
  hasta?: string;
}

/** Listado liviano: nunca incluye las imágenes de los comprobantes. */
export async function listarPagos(
  db: BaseDatos,
  filtro: FiltroPagos = {},
): Promise<Pago[]> {
  const [pagos, aplicaciones] = await Promise.all([
    db.pagos.toArray(),
    db.aplicacionesPago.toArray(),
  ]);
  const tipoPorPago = new Map<string, TipoObligacion>();
  for (const aplicacion of aplicaciones) {
    if (aplicacion.cargoId) tipoPorPago.set(aplicacion.pagoId, 'SUSCRIPCION');
    else if (aplicacion.cuotaId) tipoPorPago.set(aplicacion.pagoId, 'PRESTAMO');
  }

  return pagos
    .filter((pago) => {
      if (filtro.personaId && pago.personaId !== filtro.personaId) return false;
      if (filtro.estado && pago.estado !== filtro.estado) return false;
      if (
        filtro.metodoPago &&
        pago.metodoPago.toUpperCase() !== filtro.metodoPago.toUpperCase()
      ) {
        return false;
      }
      if (filtro.tipo && tipoPorPago.get(pago.id) !== filtro.tipo) return false;
      if (filtro.desde && pago.fechaPago < filtro.desde) return false;
      if (filtro.hasta && pago.fechaPago > filtro.hasta) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.fechaPago !== b.fechaPago) return b.fechaPago.localeCompare(a.fechaPago);
      return b.creadoEn.localeCompare(a.creadoEn);
    });
}

export async function obtenerComprobantes(
  db: BaseDatos,
  pagoId: string,
): Promise<ComprobantePago[]> {
  return db.comprobantesPago.where('pagoId').equals(pagoId).toArray();
}

/* ------------------------------- CU-15 ------------------------------- */

export async function anularPago(
  db: BaseDatos,
  pagoId: string,
  motivo: string,
  usuarioId?: string,
): Promise<Pago> {
  const pago = await db.pagos.get(pagoId);
  if (!pago) throw new ErrorNoEncontrado('El pago no existe.');
  const texto = motivo?.trim() ?? '';
  if (!texto) {
    throw new ErrorValidacion('El motivo es obligatorio.', 'motivo');
  }
  if (pago.estado === 'ANULADO') {
    throw new ErrorReglaNegocio('El pago ya está anulado.');
  }

  const aplicaciones = await db.aplicacionesPago
    .where('pagoId')
    .equals(pagoId)
    .toArray();

  const [todosPagos, todasAplicaciones] = await Promise.all([
    db.pagos.toArray(),
    db.aplicacionesPago.toArray(),
  ]);
  const pagosValidos = new Set(
    todosPagos
      .filter((p) => p.estado === 'REGISTRADO' && p.id !== pagoId)
      .map((p) => p.id),
  );

  const pagadoRestante = (idObligacion: string, campo: 'cargoId' | 'cuotaId') =>
    todasAplicaciones
      .filter(
        (a) =>
          a[campo] === idObligacion &&
          pagosValidos.has(a.pagoId) &&
          a.pagoId !== pagoId,
      )
      .reduce((total, a) => total + a.montoAplicadoCentimos, 0);

  const actualizado: Pago = {
    ...pago,
    estado: 'ANULADO',
    motivoAnulacion: texto,
  };

  await db.transaction(
    'rw',
    [db.pagos, db.cargosSuscripcion, db.cuotasPrestamo, db.prestamos, db.auditoria],
    async () => {
      await db.pagos.put(actualizado);

      const prestamosAfectados = new Set<string>();
      for (const aplicacion of aplicaciones) {
        if (aplicacion.cargoId) {
          const cargo = await db.cargosSuscripcion.get(aplicacion.cargoId);
          if (!cargo) continue;
          const pagado = pagadoRestante(cargo.id, 'cargoId');
          const saldo = Math.max(0, cargo.montoCentimos - pagado);
          const estado =
            saldo <= 0 ? 'PAGADO' : pagado > 0 ? 'PARCIAL' : 'PENDIENTE';
          await db.cargosSuscripcion.update(cargo.id, { estado });
        }
        if (aplicacion.cuotaId) {
          const cuota = await db.cuotasPrestamo.get(aplicacion.cuotaId);
          if (!cuota) continue;
          const pagado = pagadoRestante(cuota.id, 'cuotaId');
          const saldo = Math.max(0, cuota.montoProgramadoCentimos - pagado);
          const estado =
            saldo <= 0 ? 'PAGADA' : pagado > 0 ? 'PARCIAL' : 'PENDIENTE';
          await db.cuotasPrestamo.update(cuota.id, { estado });
          prestamosAfectados.add(cuota.prestamoId);
        }
      }

      for (const prestamoId of prestamosAfectados) {
        const prestamo = await db.prestamos.get(prestamoId);
        if (!prestamo) continue;
        const cuotas = await db.cuotasPrestamo
          .where('prestamoId')
          .equals(prestamoId)
          .toArray();
        const quedaPendiente = cuotas.some((cuota) => {
          const pagado = pagadoRestante(cuota.id, 'cuotaId');
          return pagado < cuota.montoProgramadoCentimos;
        });
        if (prestamo.estado === 'CANCELADO' && quedaPendiente) {
          await db.prestamos.update(prestamoId, {
            estado: 'ACTIVO',
            fechaEstado: new Date().toISOString(),
          });
        }
      }

      await auditar(db, {
        entidad: 'PAGO',
        entidadId: pagoId,
        accion: 'ANULAR',
        usuarioId,
        antes: { estado: pago.estado },
        despues: {
          estado: 'ANULADO',
          motivo: texto,
          aplicacionesRevertidas: aplicaciones.length,
        },
      });
    },
  );

  return actualizado;
}


