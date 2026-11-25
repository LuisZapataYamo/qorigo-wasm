import Dexie, { type Table } from 'dexie';
import type {
  AplicacionPago,
  AuditoriaRegistro,
  CargoSuscripcion,
  ComprobantePago,
  Configuracion,
  CostoSuscripcionPeriodo,
  CuotaAjuste,
  CuotaPrestamo,
  MiembroSuscripcion,
  Moneda,
  Pago,
  Persona,
  Plataforma,
  Prestamo,
  RecordatorioEnviado,
  SesionRegistro,
  Suscripcion,
  Usuario,
} from './tipos';

export class BaseDatos extends Dexie {
  personas!: Table<Persona, string>;
  usuarios!: Table<Usuario, string>;
  monedas!: Table<Moneda, string>;
  plataformas!: Table<Plataforma, string>;
  suscripciones!: Table<Suscripcion, string>;
  costosSuscripcionPeriodo!: Table<CostoSuscripcionPeriodo, string>;
  miembrosSuscripcion!: Table<MiembroSuscripcion, string>;
  cargosSuscripcion!: Table<CargoSuscripcion, string>;
  prestamos!: Table<Prestamo, string>;
  cuotasPrestamo!: Table<CuotaPrestamo, string>;
  cuotaAjustes!: Table<CuotaAjuste, string>;
  pagos!: Table<Pago, string>;
  aplicacionesPago!: Table<AplicacionPago, string>;
  comprobantesPago!: Table<ComprobantePago, string>;
  auditoria!: Table<AuditoriaRegistro, string>;
  configuracion!: Table<Configuracion, string>;
  sesion!: Table<SesionRegistro, string>;
  recordatorios!: Table<RecordatorioEnviado, string>;

  constructor(nombre = 'qorigo') {
    super(nombre);
    this.version(1).stores({
      personas: 'id, documento, nombreNormalizado',
      usuarios: 'id, personaId, email, rol',
      monedas: 'codigo',
      plataformas: 'id, nombre',
      suscripciones: 'id, plataformaId, estado',
      costosSuscripcionPeriodo:
        'id, suscripcionId, periodo, [suscripcionId+periodo]',
      miembrosSuscripcion:
        'id, suscripcionId, personaId, estado, [suscripcionId+personaId]',
      cargosSuscripcion: 'id, miembroId, periodo, estado, [miembroId+periodo]',
      prestamos: 'id, personaId, estado',
      cuotasPrestamo: 'id, prestamoId, estado, [prestamoId+numeroCuota]',
      cuotaAjustes: 'id, cuotaId',
      pagos: 'id, personaId, estado, fechaPago, moneda',
      aplicacionesPago: 'id, pagoId, cargoId, cuotaId',
      comprobantesPago: 'id, pagoId, sha256',
      auditoria: 'id, entidad, entidadId, creadoEn',
      configuracion: 'clave',
      sesion: 'clave',
    });
    // v2: historial de recordatorios ya mostrados.
    this.version(2).stores({
      recordatorios: 'clave, entidadId, enviadoEn',
    });
  }
}

export const db = new BaseDatos();

export function crearBaseDeDatos(nombre = 'qorigo-pruebas'): BaseDatos {
  return new BaseDatos(nombre);
}
