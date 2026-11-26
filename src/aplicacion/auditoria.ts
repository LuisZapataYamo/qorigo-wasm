import type { AuditoriaRegistro } from '../dominio/modelo';
import { nuevoId } from '../dominio/ids';
import type { DatosQoriGo } from './puertos/persistencia';

export type EntradaAuditoria = Omit<AuditoriaRegistro, 'id' | 'creadoEn'>;

/** Registra quién, cuándo y qué cambió. */
export async function auditar(
  datos: DatosQoriGo,
  entrada: EntradaAuditoria,
): Promise<void> {
  await datos.auditoria.add({
    ...entrada,
    id: nuevoId(),
    creadoEn: new Date().toISOString(),
  });
}

export async function leerConfiguracion(
  datos: DatosQoriGo,
  clave: string,
  porDefecto = '',
): Promise<string> {
  const registro = await datos.configuracion.get(clave);
  return registro?.valor ?? porDefecto;
}

export async function guardarConfiguracion(
  datos: DatosQoriGo,
  clave: string,
  valor: string,
): Promise<void> {
  await datos.configuracion.put({ clave, valor });
}
