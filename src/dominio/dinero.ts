import { ErrorValidacion } from './errores';

/**
 * Los importes se guardan siempre como enteros en la unidad mínima de la
 * moneda (céntimos). Nunca se usa coma flotante para calcular dinero.
 */
export function aCentimos(valor: number | string): number {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) {
      throw new ErrorValidacion('El monto no es un número válido.');
    }
    return Math.round(valor * 100);
  }
  const limpio = valor.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(limpio)) {
    throw new ErrorValidacion('El monto debe tener como máximo dos decimales.');
  }
  const negativo = limpio.startsWith('-');
  const sinSigno = negativo ? limpio.slice(1) : limpio;
  const [enteros, decimales = ''] = sinSigno.split('.');
  const centimos = Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
  return negativo ? -centimos : centimos;
}

export function aSoles(centimos: number): number {
  return centimos / 100;
}

export function formatearMoneda(
  centimos: number,
  moneda = 'PEN',
): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centimos / 100);
}

/** Reparte un importe en partes proporcionales sin perder ni inventar céntimos. */
export function repartirProporcional(
  total: number,
  pesos: number[],
): number[] {
  const sumaPesos = pesos.reduce((a, b) => a + b, 0);
  if (sumaPesos <= 0 || total <= 0) return pesos.map(() => 0);
  const brutos = pesos.map((p) => (total * p) / sumaPesos);
  const base = brutos.map((b) => Math.floor(b));
  let resto = total - base.reduce((a, b) => a + b, 0);
  const orden = brutos
    .map((b, i) => ({ i, frac: b - Math.floor(b) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of orden) {
    if (resto <= 0) break;
    base[i] += 1;
    resto -= 1;
  }
  return base;
}
