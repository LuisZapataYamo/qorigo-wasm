import type { DatosQoriGo } from './puertos/persistencia';
import type {
  EstadoSuscripcion,
  MiembroSuscripcion,
  Plataforma,
  Suscripcion,
} from '../dominio/modelo';
import { auditar } from './auditoria';
import { aCentimos } from '../dominio/dinero';
import {
  ErrorNoEncontrado,
  ErrorReglaNegocio,
  ErrorValidacion,
} from '../dominio/errores';
import { esFechaValida, periodoActual } from '../dominio/fechas';
import { nuevoId } from '../dominio/ids';
import { normalizar } from '../dominio/normalizar';
import { pagadoDeCargo, cargarAuxiliaresSaldos } from './saldos';

export interface EntradaSuscripcion {
  plataformaId: string;
  nombre: string;
  moneda: string;
  costo: number | string;
  capacidad: number;
  diaCobro: number;
  fechaInicio: string;
  esUsoPersonal?: boolean;
}

export interface DetalleSuscripcion {
  suscripcion: Suscripcion;
  plataforma: Plataforma;
  costoPorPlazaCentimos: number;
  plazasOcupadas: number;
  plazasLibres: number;
  coberturaCentimos: number;
  enDeficit: boolean;
  miembros: MiembroSuscripcion[];
  periodo: string;
  esperadoCentimos: number;
  cobradoCentimos: number;
  pendienteCentimos: number;
}

function validarDiaCobro(dia: number): void {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    throw new ErrorValidacion(
      'El día de cobro debe estar entre 1 y 31.',
      'diaCobro',
    );
  }
}

export async function costoVigentePara(
  db: DatosQoriGo,
  suscripcionId: string,
  periodo: string,
): Promise<number> {
  const historico = await db.costosSuscripcionPeriodo
    .where('[suscripcionId+periodo]')
    .equals([suscripcionId, periodo])
    .first();
  if (historico) return historico.montoCentimos;
  const suscripcion = await db.suscripciones.get(suscripcionId);
  if (!suscripcion) throw new ErrorNoEncontrado('La suscripción no existe.');
  return suscripcion.costoCentimos;
}

export async function crearSuscripcion(
  db: DatosQoriGo,
  entrada: EntradaSuscripcion,
): Promise<Suscripcion> {
  const nombre = entrada.nombre?.trim() ?? '';
  if (!nombre) {
    throw new ErrorValidacion('El nombre es obligatorio.', 'nombre');
  }
  const plataforma = await db.plataformas.get(entrada.plataformaId);
  if (!plataforma) {
    throw new ErrorValidacion('La plataforma no existe.', 'plataformaId');
  }
  if (!(await db.monedas.get(entrada.moneda))) {
    throw new ErrorValidacion('La moneda no existe.', 'moneda');
  }
  const costoCentimos = aCentimos(entrada.costo);
  if (costoCentimos <= 0) {
    throw new ErrorValidacion('El costo debe ser mayor que cero.', 'costo');
  }
  if (!Number.isInteger(entrada.capacidad) || entrada.capacidad < 1) {
    throw new ErrorValidacion(
      'La capacidad debe ser al menos 1.',
      'capacidad',
    );
  }
  validarDiaCobro(entrada.diaCobro);
  if (!esFechaValida(entrada.fechaInicio)) {
    throw new ErrorValidacion(
      'La fecha de inicio no es válida.',
      'fechaInicio',
    );
  }

  const suscripcion: Suscripcion = {
    id: nuevoId(),
    plataformaId: entrada.plataformaId,
    nombre,
    moneda: entrada.moneda,
    costoCentimos,
    periodicidad: 'MENSUAL',
    capacidad: entrada.capacidad,
    diaCobro: entrada.diaCobro,
    fechaInicio: entrada.fechaInicio,
    estado: 'ACTIVA',
    esUsoPersonal: entrada.esUsoPersonal ?? false,
    creadoEn: new Date().toISOString(),
  };

  await db.transaction('rw', db.suscripciones, db.auditoria, async () => {
    await db.suscripciones.add(suscripcion);
    await auditar(db, {
      entidad: 'SUSCRIPCION',
      entidadId: suscripcion.id,
      accion: 'CREAR',
      despues: suscripcion,
    });
  });

  return suscripcion;
}

export async function obtenerSuscripcion(
  db: DatosQoriGo,
  id: string,
): Promise<Suscripcion> {
  const suscripcion = await db.suscripciones.get(id);
  if (!suscripcion) throw new ErrorNoEncontrado('La suscripción no existe.');
  return suscripcion;
}

export async function listarSuscripciones(
  db: DatosQoriGo,
  filtro: { busqueda?: string; estado?: EstadoSuscripcion | 'TODAS' } = {},
): Promise<Array<Suscripcion & { plataforma: string }>> {
  const busqueda = normalizar(filtro.busqueda ?? '');
  const estado = filtro.estado ?? 'TODAS';
  const [suscripciones, plataformas] = await Promise.all([
    db.suscripciones.toArray(),
    db.plataformas.toArray(),
  ]);
  const mapa = new Map(plataformas.map((p) => [p.id, p.nombre]));
  return suscripciones
    .filter((s) => (estado === 'TODAS' ? true : s.estado === estado))
    .filter((s) =>
      busqueda
        ? normalizar(`${s.nombre} ${mapa.get(s.plataformaId) ?? ''}`).includes(
            busqueda,
          )
        : true,
    )
    .map((s) => ({ ...s, plataforma: mapa.get(s.plataformaId) ?? '—' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function detalleSuscripcion(
  db: DatosQoriGo,
  id: string,
  periodo = periodoActual(),
): Promise<DetalleSuscripcion> {
  const suscripcion = await obtenerSuscripcion(db, id);
  const plataforma = await db.plataformas.get(suscripcion.plataformaId);
  if (!plataforma) throw new ErrorNoEncontrado('La plataforma no existe.');

  const miembros = await db.miembrosSuscripcion
    .where('suscripcionId')
    .equals(id)
    .toArray();
  const activos = miembros.filter((m) => m.estado === 'ACTIVO');
  // Sin miembros todavía no hay cobertura que evaluar: el detalle recién
  // creado muestra 0 (CU-03). El informe de pérdidas sí compara contra el costo.
  const coberturaCentimos =
    activos.length === 0
      ? 0
      : activos.reduce((total, m) => total + m.montoAcordadoCentimos, 0) -
        suscripcion.costoCentimos;

  const aux = await cargarAuxiliaresSaldos(db);
  let esperadoCentimos = 0;
  let cobradoCentimos = 0;
  for (const miembro of miembros) {
    const cargos = await db.cargosSuscripcion
      .where('miembroId')
      .equals(miembro.id)
      .and((c) => c.periodo === periodo && c.estado !== 'ANULADO')
      .toArray();
    for (const cargo of cargos) {
      esperadoCentimos += cargo.montoCentimos;
      cobradoCentimos += pagadoDeCargo(aux, cargo.id);
    }
  }

  return {
    suscripcion,
    plataforma,
    costoPorPlazaCentimos: Math.round(
      suscripcion.costoCentimos / suscripcion.capacidad,
    ),
    plazasOcupadas: activos.length,
    plazasLibres: suscripcion.capacidad - activos.length,
    coberturaCentimos,
    enDeficit: coberturaCentimos < 0,
    miembros,
    periodo,
    esperadoCentimos,
    cobradoCentimos,
    pendienteCentimos: esperadoCentimos - cobradoCentimos,
  };
}

export interface CambiosSuscripcion {
  nombre?: string;
  costo?: number | string;
  capacidad?: number;
  diaCobro?: number;
  estado?: EstadoSuscripcion;
  esUsoPersonal?: boolean;
}

export async function actualizarSuscripcion(
  db: DatosQoriGo,
  id: string,
  cambios: CambiosSuscripcion,
): Promise<Suscripcion> {
  const anterior = await obtenerSuscripcion(db, id);
  const actualizada: Suscripcion = { ...anterior };

  if (cambios.nombre !== undefined) {
    const nombre = cambios.nombre.trim();
    if (!nombre) {
      throw new ErrorValidacion('El nombre es obligatorio.', 'nombre');
    }
    actualizada.nombre = nombre;
  }

  if (cambios.costo !== undefined) {
    const costoCentimos = aCentimos(cambios.costo);
    if (costoCentimos <= 0) {
      throw new ErrorValidacion('El costo debe ser mayor que cero.', 'costo');
    }
    actualizada.costoCentimos = costoCentimos;
  }

  if (cambios.capacidad !== undefined) {
    if (!Number.isInteger(cambios.capacidad) || cambios.capacidad < 1) {
      throw new ErrorValidacion(
        'La capacidad debe ser al menos 1.',
        'capacidad',
      );
    }
    const ocupadas = await db.miembrosSuscripcion
      .where('suscripcionId')
      .equals(id)
      .and((m) => m.estado === 'ACTIVO')
      .count();
    if (cambios.capacidad < ocupadas) {
      throw new ErrorReglaNegocio(
        `La capacidad no puede ser menor que las ${ocupadas} plazas ocupadas.`,
      );
    }
    actualizada.capacidad = cambios.capacidad;
  }

  if (cambios.diaCobro !== undefined) {
    validarDiaCobro(cambios.diaCobro);
    actualizada.diaCobro = cambios.diaCobro;
  }

  if (cambios.estado !== undefined) {
    actualizada.estado = cambios.estado;
  }

  if (cambios.esUsoPersonal !== undefined) {
    actualizada.esUsoPersonal = cambios.esUsoPersonal;
  }

  await db.transaction('rw', db.suscripciones, db.auditoria, async () => {
    await db.suscripciones.put(actualizada);
    await auditar(db, {
      entidad: 'SUSCRIPCION',
      entidadId: id,
      accion: 'ACTUALIZAR',
      antes: anterior,
      despues: actualizada,
    });
  });

  return actualizada;
}
