import { normalizar } from './normalizar';

export function nombreCompleto(nombres: string, apellidos: string): string {
  return `${nombres} ${apellidos}`.replace(/\s+/g, ' ').trim();
}

export function nombreNormalizado(nombres: string, apellidos: string): string {
  return normalizar(nombreCompleto(nombres, apellidos));
}
