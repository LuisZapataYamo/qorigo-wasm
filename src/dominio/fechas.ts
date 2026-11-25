export const ZONA_HORARIA = 'America/Lima';

const FORMATEADOR = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

let hoyFijado: string | null = null;

/** Fija la fecha de hoy para pruebas; `null` vuelve al reloj real. */
export function fijarHoy(fecha: string | null): void {
  hoyFijado = fecha;
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de Lima o la fijada en pruebas. */
export function hoy(): string {
  if (hoyFijado) return hoyFijado;
  return FORMATEADOR.format(new Date());
}

export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [a, m, d] = fecha.split('-').map(Number);
  const prueba = new Date(Date.UTC(a, m - 1, d));
  return (
    prueba.getUTCFullYear() === a &&
    prueba.getUTCMonth() === m - 1 &&
    prueba.getUTCDate() === d
  );
}

export function partes(fecha: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (!anio || !mes || !dia) throw new Error(`Fecha inválida: ${fecha}`);
  return { anio, mes, dia };
}

export function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

export function periodoDe(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

export function periodoActual(): string {
  return periodoDe(hoy());
}

/** Suma meses ajustando al último día del mes destino (31 → 30 o 28). */
export function sumarMeses(fecha: string, meses: number): string {
  const { anio, mes, dia } = partes(fecha);
  const total = anio * 12 + (mes - 1) + meses;
  const anioDestino = Math.floor(total / 12);
  const mesDestino = (((total % 12) + 12) % 12) + 1;
  const diaDestino = Math.min(dia, ultimoDiaDelMes(anioDestino, mesDestino));
  return `${String(anioDestino).padStart(4, '0')}-${String(mesDestino).padStart(2, '0')}-${String(diaDestino).padStart(2, '0')}`;
}

export function finDeMes(periodo: string): string {
  const { anio, mes } = partes(periodo);
  return `${periodo.slice(0, 7)}-${String(ultimoDiaDelMes(anio, mes)).padStart(2, '0')}`;
}

export function inicioDeMes(periodo: string): string {
  return periodoDe(periodo);
}

export function periodoAnterior(periodo: string): string {
  return sumarMeses(periodo, -1);
}

export function periodoSiguiente(periodo: string): string {
  return sumarMeses(periodo, 1);
}

export function vencimientoEnPeriodo(periodo: string, diaCobro: number): string {
  const { anio, mes } = partes(periodo);
  const dia = Math.min(Math.max(1, diaCobro), ultimoDiaDelMes(anio, mes));
  return `${periodo.slice(0, 7)}-${String(dia).padStart(2, '0')}`;
}

/** Días completos transcurridos de `desde` a `hasta` (puede ser negativo). */
export function diasEntre(desde: string, hasta: string): number {
  const a = partes(desde);
  const b = partes(hasta);
  const inicio = Date.UTC(a.anio, a.mes - 1, a.dia);
  const fin = Date.UTC(b.anio, b.mes - 1, b.dia);
  return Math.round((fin - inicio) / 86_400_000);
}

export function serieMeses(periodoFinal: string, cantidad: number): string[] {
  const meses: string[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    meses.push(sumarMeses(periodoFinal, -i));
  }
  return meses;
}

export function etiquetaPeriodo(periodo: string): string {
  const { anio, mes } = partes(periodo);
  return new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, mes - 1, 1)));
}

export function formatearFecha(fecha: string): string {
  const { anio, mes, dia } = partes(fecha);
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}
