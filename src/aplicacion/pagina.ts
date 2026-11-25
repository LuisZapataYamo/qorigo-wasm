export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  tamano: number;
  paginas: number;
}

export function paginar<T>(
  items: T[],
  pagina = 1,
  tamano = 20,
): Pagina<T> {
  const tamanoSeguro = Math.max(1, tamano);
  const total = items.length;
  const paginas = Math.max(1, Math.ceil(total / tamanoSeguro));
  const paginaSegura = Math.min(Math.max(1, pagina), paginas);
  const inicio = (paginaSegura - 1) * tamanoSeguro;
  return {
    items: items.slice(inicio, inicio + tamanoSeguro),
    total,
    pagina: paginaSegura,
    tamano: tamanoSeguro,
    paginas,
  };
}
