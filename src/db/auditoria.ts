import type { BaseDatos } from '../db/baseDatos';
import type { AuditoriaRegistro } from '../db/tipos';
import { nuevoId } from '../dominio/ids';

export type EntradaAuditoria = Omit<AuditoriaRegistro, 'id' | 'creadoEn'>;

/** Registra quién, cuándo y qué cambió. */
export async function auditar(
  db: BaseDatos,
  entrada: EntradaAuditoria,
): Promise<void> {
  await db.auditoria.add({
    ...entrada,
    id: nuevoId(),
    creadoEn: new Date().toISOString(),
  });
}

export async function leerConfiguracion(
  db: BaseDatos,
  clave: string,
  porDefecto = '',
): Promise<string> {
  const registro = await db.configuracion.get(clave);
  return registro?.valor ?? porDefecto;
}

export async function guardarConfiguracion(
  db: BaseDatos,
  clave: string,
  valor: string,
): Promise<void> {
  await db.configuracion.put({ clave, valor });
}
