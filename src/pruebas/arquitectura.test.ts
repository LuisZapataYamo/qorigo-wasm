import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = process.cwd();

function archivos(dir: string): string[] {
  return readdirSync(join(RAIZ, dir), { withFileTypes: true }).flatMap(
    (entrada) => {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) return archivos(ruta);
      return /\.(ts|tsx)$/.test(entrada.name) ? [ruta] : [];
    },
  );
}

function importaciones(archivo: string): string[] {
  const contenido = readFileSync(join(RAIZ, archivo), 'utf8');
  const encontradas = new Set<string>();
  const estaticas = /from\s+['"]([^'"]+)['"]/g;
  const dinamicas = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const regex of [estaticas, dinamicas]) {
    let coincidencia: RegExpExecArray | null;
    while ((coincidencia = regex.exec(contenido)) !== null) {
      encontradas.add(coincidencia[1]);
    }
  }
  return [...encontradas];
}

function infringe(
  archivo: string,
  prohibidos: Array<(importacion: string) => boolean>,
): string[] {
  return importaciones(archivo).filter((importacion) =>
    prohibidos.some((regla) => regla(importacion)),
  );
}

const esCapaProhibidaParaDominio = (importacion: string) =>
  importacion.startsWith('../aplicacion') ||
  importacion.startsWith('../infraestructura') ||
  importacion.startsWith('../ui') ||
  importacion === 'react' ||
  importacion === 'dexie';

const esCapaProhibidaParaAplicacion = (importacion: string) =>
  importacion.startsWith('../infraestructura') ||
  importacion.startsWith('../ui') ||
  importacion === 'react' ||
  importacion === 'dexie';

describe('arquitectura hexagonal', () => {
  it('el dominio no depende de aplicación, infraestructura ni interfaz', () => {
    const violaciones = archivos('src/dominio').flatMap((archivo) =>
      infringe(archivo, [esCapaProhibidaParaDominio]).map(
        (importacion) => `${relative(RAIZ, join(RAIZ, archivo))} → ${importacion}`,
      ),
    );
    expect(violaciones).toEqual([]);
  });

  it('la aplicación no depende de infraestructura, interfaz ni Dexie', () => {
    const violaciones = archivos('src/aplicacion').flatMap((archivo) =>
      infringe(archivo, [esCapaProhibidaParaAplicacion]).map(
        (importacion) => `${relative(RAIZ, join(RAIZ, archivo))} → ${importacion}`,
      ),
    );
    expect(violaciones).toEqual([]);
  });

  it('la infraestructura solo se importa desde la composición y la interfaz', () => {
    const violaciones = [
      ...archivos('src/dominio'),
      ...archivos('src/aplicacion'),
    ].flatMap((archivo) =>
      infringe(archivo, [
        (importacion) => importacion.includes('infraestructura/'),
      ]).map(
        (importacion) => `${relative(RAIZ, join(RAIZ, archivo))} → ${importacion}`,
      ),
    );
    expect(violaciones).toEqual([]);
  });
});
