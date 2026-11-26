import type { BaseDatos } from './baseDatos';
import { nuevoId } from '../../dominio/ids';

export const MONEDAS_INICIALES = [
  { codigo: 'PEN', nombre: 'Sol peruano', decimales: 2, simbolo: 'S/' },
  { codigo: 'USD', nombre: 'Dólar estadounidense', decimales: 2, simbolo: '$' },
  { codigo: 'EUR', nombre: 'Euro', decimales: 2, simbolo: '€' },
];

export const PLATAFORMAS_INICIALES = ['YouTube', 'Microsoft', 'Obsidian'];

export const CONFIGURACION_INICIAL: Record<string, string> = {
  umbral_riesgo_dias: '30',
  imagen_ancho: '100',
  imagen_alto: '100',
  metodos_con_comprobante: 'YAPE,PLIN,TRANSFERENCIA',
  moneda_por_defecto: 'PEN',
  version_esquema: '1',
  notificaciones_activas: 'NO',
  recordatorios_dias: '3',
};

/** Carga catálogos y configuración una sola vez. Es idempotente. */
export async function asegurarSemilla(db: BaseDatos): Promise<void> {
  await db.transaction(
    'rw',
    db.monedas,
    db.plataformas,
    db.configuracion,
    async () => {
      for (const moneda of MONEDAS_INICIALES) {
        if (!(await db.monedas.get(moneda.codigo))) {
          await db.monedas.put(moneda);
        }
      }
      for (const nombre of PLATAFORMAS_INICIALES) {
        const existente = await db.plataformas
          .filter((p) => p.nombre.toLowerCase() === nombre.toLowerCase())
          .first();
        if (!existente) {
          await db.plataformas.add({
            id: nuevoId(),
            nombre,
            activo: true,
          });
        }
      }
      for (const [clave, valor] of Object.entries(CONFIGURACION_INICIAL)) {
        if (!(await db.configuracion.get(clave))) {
          await db.configuracion.add({ clave, valor });
        }
      }
    },
  );
}
