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
} from '../../dominio/modelo';

/**
 * Puerto de persistencia. La capa de aplicación solo conoce estas operaciones
 * de colección; Dexie queda en infraestructura. La forma es deliberadamente
 * mínima y compatible con una unidad de trabajo local (IndexedDB).
 */
export interface Consulta<T> {
  toArray(): Promise<T[]>;
  first(): Promise<T | undefined>;
  count(): Promise<number>;
  and(predicado: (valor: T) => boolean): Consulta<T>;
}

export interface Filtro<T> {
  equals(valor: unknown): Consulta<T>;
  anyOf(valores: readonly unknown[]): Consulta<T>;
}

export interface Tabla<T, K extends string = string> {
  toArray(): Promise<T[]>;
  get(clave: K): Promise<T | undefined>;
  add(entidad: T): Promise<K>;
  put(entidad: T): Promise<K>;
  delete(clave: K): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
  update(clave: K, cambios: Partial<T>): Promise<number>;
  where(indice: string): Filtro<T>;
  filter(predicado: (valor: T) => boolean): Consulta<T>;
}

export interface DatosQoriGo {
  personas: Tabla<Persona>;
  usuarios: Tabla<Usuario>;
  monedas: Tabla<Moneda>;
  plataformas: Tabla<Plataforma>;
  suscripciones: Tabla<Suscripcion>;
  costosSuscripcionPeriodo: Tabla<CostoSuscripcionPeriodo>;
  miembrosSuscripcion: Tabla<MiembroSuscripcion>;
  cargosSuscripcion: Tabla<CargoSuscripcion>;
  prestamos: Tabla<Prestamo>;
  cuotasPrestamo: Tabla<CuotaPrestamo>;
  cuotaAjustes: Tabla<CuotaAjuste>;
  pagos: Tabla<Pago>;
  aplicacionesPago: Tabla<AplicacionPago>;
  comprobantesPago: Tabla<ComprobantePago>;
  auditoria: Tabla<AuditoriaRegistro>;
  configuracion: Tabla<Configuracion>;
  sesion: Tabla<SesionRegistro>;
  recordatorios: Tabla<RecordatorioEnviado>;

  transaction<R>(
    mode: 'rw',
    tables: unknown,
    scope: () => Promise<R>,
  ): Promise<R>;
  transaction<R>(
    mode: 'rw',
    table1: unknown,
    table2: unknown,
    scope: () => Promise<R>,
  ): Promise<R>;
  transaction<R>(
    mode: 'rw',
    table1: unknown,
    table2: unknown,
    table3: unknown,
    scope: () => Promise<R>,
  ): Promise<R>;
  transaction<R>(
    mode: 'rw',
    table1: unknown,
    table2: unknown,
    table3: unknown,
    table4: unknown,
    scope: () => Promise<R>,
  ): Promise<R>;
  transaction<R>(
    mode: 'rw',
    table1: unknown,
    table2: unknown,
    table3: unknown,
    table4: unknown,
    table5: unknown,
    scope: () => Promise<R>,
  ): Promise<R>;
  transaction<R>(
    mode: 'rw',
    table1: unknown,
    table2: unknown,
    table3: unknown,
    table4: unknown,
    table5: unknown,
    table6: unknown,
    scope: () => Promise<R>,
  ): Promise<R>;
  transaction<R>(
    mode: 'rw',
    table1: unknown,
    table2: unknown,
    table3: unknown,
    table4: unknown,
    table5: unknown,
    table6: unknown,
    table7: unknown,
    scope: () => Promise<R>,
  ): Promise<R>;
}
