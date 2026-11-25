/** Minúsculas, sin tildes ni signos, con espacios simples. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Compara dos textos sin tildes ni mayúsculas. */
export function coincide(a: string, b: string): boolean {
  return normalizar(a) === normalizar(b);
}

export function contieneNormalizado(texto: string, busqueda: string): boolean {
  return normalizar(texto).includes(normalizar(busqueda));
}
