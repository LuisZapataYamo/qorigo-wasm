import sharp from 'sharp';
import type { Decodificador } from '../aplicacion/comprobantes';

/**
 * Decodificador de pruebas. En el navegador se usa createImageBitmap; aquí
 * sharp aplica la orientación EXIF igual que el navegador y entrega RGBA.
 */
export const decodificarConSharp: Decodificador = async (blob) => {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const { data, info } = await sharp(buffer)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    ancho: info.width,
    alto: info.height,
    datos: new Uint8ClampedArray(data),
  };
};

export interface PngLeido {
  ancho: number;
  alto: number;
  canales: number;
  datos: Uint8Array;
}

export async function leerPng(imagen: Blob): Promise<PngLeido> {
  const buffer = Buffer.from(await imagen.arrayBuffer());
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    ancho: info.width,
    alto: info.height,
    canales: info.channels,
    datos: new Uint8Array(data),
  };
}

export function pixel(
  png: PngLeido,
  x: number,
  y: number,
): { r: number; g: number; b: number } {
  const i = (y * png.ancho + x) * png.canales;
  return { r: png.datos[i], g: png.datos[i + 1], b: png.datos[i + 2] };
}
