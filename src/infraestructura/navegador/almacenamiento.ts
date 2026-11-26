export interface EstimacionAlmacenamiento {
  usoBytes: number;
  cuotaBytes: number;
  porcentajeUsado: number;
}

/** La persistencia evita que el navegador borre los datos por falta de espacio. */
export async function solicitarPersistencia(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function persistenciaDisponible(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.persist === 'function'
  );
}

export async function estimarAlmacenamiento(): Promise<EstimacionAlmacenamiento | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return null;
  }
  try {
    const estimacion = await navigator.storage.estimate();
    const uso = estimacion.usage ?? 0;
    const cuota = estimacion.quota ?? 0;
    return {
      usoBytes: uso,
      cuotaBytes: cuota,
      porcentajeUsado: cuota > 0 ? Math.round((uso / cuota) * 10000) / 100 : 0,
    };
  } catch {
    return null;
  }
}

export function formatearBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  const indice = Math.min(
    unidades.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const valor = bytes / 1024 ** indice;
  const texto = Number.isInteger(valor)
    ? String(valor)
    : valor.toFixed(valor >= 10 || indice === 0 ? 0 : 1);
  return `${texto} ${unidades[indice]}`;
}
