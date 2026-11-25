import type { BaseDatos } from '../db/baseDatos';
import type { Suscripcion } from '../db/tipos';
import { auditar } from '../db/auditoria';
import { ErrorValidacion } from '../dominio/errores';
import {
  esFechaValida,
  finDeMes,
  periodoDe,
  vencimientoEnPeriodo,
} from '../dominio/fechas';
import { nuevoId } from '../dominio/ids';

export interface ErrorGeneracion {
  suscripcionId: string;
  nombre: string;
  mensaje: string;
}

export interface ResultadoGeneracion {
  periodo: string;
  procesadas: number;
  costosCreados: number;
  cargosCreados: number;
  errores: ErrorGeneracion[];
}

export interface OpcionesGeneracion {
  suscripcionId?: string;
  /**
   * Hook de integración que se ejecuta antes de generar cada suscripción.
   * Permite simular fallos por suscripción sin detener el lote completo.
   */
  alProcesarSuscripcion?: (suscripcion: Suscripcion) => void | Promise<void>;
}

function validarPeriodo(periodo: string): string {
  const normalizado = periodoDe(periodo);
  if (!esFechaValida(normalizado) || normalizado.slice(-2) !== '01') {
    throw new ErrorValidacion('El periodo no es válido.', 'periodo');
  }
  return normalizado;
}

/**
 * CU-06. Genera el costo del periodo y los cargos de cada miembro activo de
 * forma idempotente. Un error en una suscripción no impide procesar el resto.
 */
export async function generarPeriodo(
  db: BaseDatos,
  periodo: string,
  opciones: OpcionesGeneracion = {},
): Promise<ResultadoGeneracion> {
  const periodoNormalizado = validarPeriodo(periodo);
  const fin = finDeMes(periodoNormalizado);

  const suscripciones = opciones.suscripcionId
    ? [await db.suscripciones.get(opciones.suscripcionId)]
    : await db.suscripciones.toArray();

  const resultado: ResultadoGeneracion = {
    periodo: periodoNormalizado,
    procesadas: 0,
    costosCreados: 0,
    cargosCreados: 0,
    errores: [],
  };

  for (const suscripcion of suscripciones) {
    if (!suscripcion) continue;
    if (suscripcion.estado !== 'ACTIVA') continue;
    if (suscripcion.fechaInicio > fin) continue;

    let costos = 0;
    let cargos = 0;

    try {
      await db.transaction(
        'rw',
        db.suscripciones,
        db.costosSuscripcionPeriodo,
        db.cargosSuscripcion,
        db.miembrosSuscripcion,
        async () => {
          const actual = await db.suscripciones.get(suscripcion.id);
          if (!actual || actual.estado !== 'ACTIVA') return;

          await opciones.alProcesarSuscripcion?.(actual);

          const costoExistente = await db.costosSuscripcionPeriodo
            .where('[suscripcionId+periodo]')
            .equals([actual.id, periodoNormalizado])
            .first();
          if (!costoExistente) {
            await db.costosSuscripcionPeriodo.add({
              id: nuevoId(),
              suscripcionId: actual.id,
              periodo: periodoNormalizado,
              montoCentimos: actual.costoCentimos,
            });
            costos += 1;
          }

          const miembros = await db.miembrosSuscripcion
            .where('suscripcionId')
            .equals(actual.id)
            .toArray();

          for (const miembro of miembros) {
            if (miembro.estado !== 'ACTIVO') continue;
            if (miembro.esPlazaPropia) continue;
            if (miembro.montoAcordadoCentimos <= 0) continue;
            if (miembro.fechaInicio > fin) continue;
            if (miembro.fechaFin && miembro.fechaFin < periodoNormalizado) {
              continue;
            }

            const existente = await db.cargosSuscripcion
              .where('[miembroId+periodo]')
              .equals([miembro.id, periodoNormalizado])
              .first();
            if (existente) continue;

            await db.cargosSuscripcion.add({
              id: nuevoId(),
              miembroId: miembro.id,
              periodo: periodoNormalizado,
              montoCentimos: miembro.montoAcordadoCentimos,
              fechaVencimiento: vencimientoEnPeriodo(
                periodoNormalizado,
                actual.diaCobro,
              ),
              estado: 'PENDIENTE',
            });
            cargos += 1;
          }
        },
      );

      resultado.procesadas += 1;
      resultado.costosCreados += costos;
      resultado.cargosCreados += cargos;

      await auditar(db, {
        entidad: 'SUSCRIPCION',
        entidadId: suscripcion.id,
        accion: 'GENERAR_PERIODO',
        despues: {
          periodo: periodoNormalizado,
          costosCreados: costos,
          cargosCreados: cargos,
        },
      });
    } catch (fallo) {
      const mensaje =
        fallo instanceof Error ? fallo.message : 'Error desconocido';
      resultado.errores.push({
        suscripcionId: suscripcion.id,
        nombre: suscripcion.nombre,
        mensaje,
      });
      await auditar(db, {
        entidad: 'SUSCRIPCION',
        entidadId: suscripcion.id,
        accion: 'ERROR_GENERACION',
        despues: { periodo: periodoNormalizado, mensaje },
      });
    }
  }

  return resultado;
}
