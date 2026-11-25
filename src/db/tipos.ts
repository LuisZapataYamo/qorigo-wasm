export type EstadoSuscripcion = 'ACTIVA' | 'SUSPENDIDA' | 'CANCELADA';
export type EstadoMiembro = 'ACTIVO' | 'INACTIVO';
export type EstadoCargo = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'ANULADO';
export type EstadoPrestamo =
  | 'ACTIVO'
  | 'CANCELADO'
  | 'INCOBRABLE'
  | 'ANULADO';
export type EstadoCuota = 'PENDIENTE' | 'PARCIAL' | 'PAGADA';
export type EstadoPago = 'REGISTRADO' | 'ANULADO';
export type Rol = 'ADMIN' | 'MEMBER';
export type TipoObligacion = 'SUSCRIPCION' | 'PRESTAMO';
export type CausaPerdida = 'TARIFA' | 'MOROSIDAD' | 'AMBAS' | null;

export interface Persona {
  id: string;
  nombres: string;
  apellidos: string;
  nombreNormalizado: string;
  documento?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  activo: boolean;
  creadoEn: string;
}

export interface Usuario {
  id: string;
  personaId: string;
  email: string;
  passwordHash: string;
  rol: Rol;
  activo: boolean;
  creadoEn: string;
}

export interface Moneda {
  codigo: string;
  nombre: string;
  decimales: number;
  simbolo: string;
}

export interface Plataforma {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
}

export interface Suscripcion {
  id: string;
  plataformaId: string;
  nombre: string;
  moneda: string;
  costoCentimos: number;
  periodicidad: 'MENSUAL';
  capacidad: number;
  diaCobro: number;
  fechaInicio: string;
  estado: EstadoSuscripcion;
  esUsoPersonal: boolean;
  creadoEn: string;
}

export interface CostoSuscripcionPeriodo {
  id: string;
  suscripcionId: string;
  periodo: string;
  montoCentimos: number;
}

export interface MiembroSuscripcion {
  id: string;
  suscripcionId: string;
  personaId: string;
  montoAcordadoCentimos: number;
  esPlazaPropia: boolean;
  fechaInicio: string;
  fechaFin?: string;
  estado: EstadoMiembro;
}

export interface CargoSuscripcion {
  id: string;
  miembroId: string;
  periodo: string;
  montoCentimos: number;
  fechaVencimiento: string;
  estado: EstadoCargo;
}

export interface Prestamo {
  id: string;
  personaId: string;
  moneda: string;
  capitalCentimos: number;
  tasaMensual: number;
  plazoMeses: number;
  fechaPrestamo: string;
  fechaPrimerPago: string;
  estrictoCumplimiento: boolean;
  estado: EstadoPrestamo;
  motivoEstado?: string;
  fechaEstado?: string;
  notas?: string;
  creadoEn: string;
}

export interface CuotaPrestamo {
  id: string;
  prestamoId: string;
  numeroCuota: number;
  fechaVencimiento: string;
  capitalProgramadoCentimos: number;
  interesProgramadoCentimos: number;
  montoProgramadoCentimos: number;
  montoOriginalCentimos: number;
  estado: EstadoCuota;
}

export interface CuotaAjuste {
  id: string;
  cuotaId: string;
  usuarioId?: string;
  montoAnteriorCentimos: number;
  montoNuevoCentimos: number;
  motivo: string;
  creadoEn: string;
}

export interface Pago {
  id: string;
  personaId: string;
  moneda: string;
  fechaPago: string;
  montoCentimos: number;
  metodoPago: string;
  referencia?: string;
  observacion?: string;
  estado: EstadoPago;
  motivoAnulacion?: string;
  creadoEn: string;
}

export interface AplicacionPago {
  id: string;
  pagoId: string;
  cargoId?: string;
  cuotaId?: string;
  montoAplicadoCentimos: number;
  montoCapitalCentimos?: number;
  montoInteresCentimos?: number;
}

export interface ComprobantePago {
  id: string;
  pagoId: string;
  imagen: Blob;
  mimeType: string;
  ancho: number;
  alto: number;
  sha256: string;
  subidoEn: string;
}

export interface AuditoriaRegistro {
  id: string;
  usuarioId?: string;
  entidad: string;
  entidadId: string;
  accion: string;
  antes?: unknown;
  despues?: unknown;
  creadoEn: string;
}

export interface Configuracion {
  clave: string;
  valor: string;
}

export interface SesionRegistro {
  clave: string;
  valor: string;
}

/** Marca de un recordatorio ya mostrado para no repetirlo. */
export interface RecordatorioEnviado {
  clave: string;
  tipo: TipoObligacion | 'FACTURACION';
  entidadId: string;
  fechaVencimiento: string;
  enviadoEn: string;
}

/** Saldos calculados de un cargo o cuota. */
export interface ObligacionPendiente {
  tipo: TipoObligacion;
  id: string;
  personaId: string;
  moneda: string;
  concepto: string;
  fechaVencimiento: string;
  montoCentimos: number;
  pagadoCentimos: number;
  saldoCentimos: number;
  capitalCentimos?: number;
  interesCentimos?: number;
}
