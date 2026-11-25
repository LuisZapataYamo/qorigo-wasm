/** Errores de negocio con un código estable para la interfaz. */
export class ErrorNegocio extends Error {
  constructor(
    public readonly codigo: string,
    mensaje: string,
    public readonly campo?: string,
  ) {
    super(mensaje);
    this.name = 'ErrorNegocio';
  }
}

export class ErrorValidacion extends ErrorNegocio {
  constructor(mensaje: string, campo?: string) {
    super('VALIDACION', mensaje, campo);
    this.name = 'ErrorValidacion';
  }
}

export class ErrorConflicto extends ErrorNegocio {
  constructor(mensaje: string) {
    super('CONFLICTO', mensaje);
    this.name = 'ErrorConflicto';
  }
}

export class ErrorNoEncontrado extends ErrorNegocio {
  constructor(mensaje: string) {
    super('NO_ENCONTRADO', mensaje);
    this.name = 'ErrorNoEncontrado';
  }
}

export class ErrorReglaNegocio extends ErrorNegocio {
  constructor(mensaje: string) {
    super('REGLA_NEGOCIO', mensaje);
    this.name = 'ErrorReglaNegocio';
  }
}

export class ErrorProhibido extends ErrorNegocio {
  constructor(mensaje: string) {
    super('PROHIBIDO', mensaje);
    this.name = 'ErrorProhibido';
  }
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}
