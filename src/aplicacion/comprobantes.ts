import { ErrorValidacion } from '../dominio/errores';
import type { ComprobanteProcesado } from './pagos';

export interface ImagenDecodificada {
  ancho: number;
  alto: number;
  /** RGBA, 4 bytes por píxel. */
  datos: Uint8ClampedArray;
}

export type { ComprobanteProcesado } from './pagos';

export type Decodificador = (blob: Blob) => Promise<ImagenDecodificada>;

export interface OpcionesProcesamiento {
  /** Se inyecta en pruebas; en el navegador se usa createImageBitmap. */
  decodificar?: Decodificador;
  tamano?: number;
}

export const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;

/* ------------------------------ PNG RGB ------------------------------ */

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) {
    c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function concatenar(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((t, p) => t + p.length, 0);
  const salida = new Uint8Array(total);
  let offset = 0;
  for (const parte of partes) {
    salida.set(parte, offset);
    offset += parte.length;
  }
  return salida;
}

function chunk(tipo: string, datos: Uint8Array): Uint8Array {
  const largo = new Uint8Array(4);
  new DataView(largo.buffer).setUint32(0, datos.length);
  const cuerpo = concatenar([
    new TextEncoder().encode(tipo),
    datos,
  ]);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32(cuerpo));
  return concatenar([largo, cuerpo, crc]);
}

function aBlobPart(datos: Uint8Array): ArrayBuffer {
  return datos.buffer.slice(
    datos.byteOffset,
    datos.byteOffset + datos.byteLength,
  ) as ArrayBuffer;
}

async function deflate(datos: Uint8Array): Promise<Uint8Array> {
  const comprimido = new Blob([aBlobPart(datos)]).stream().pipeThrough(
    new CompressionStream('deflate'),
  );
  return new Uint8Array(await new Response(comprimido).arrayBuffer());
}

/** Codifica un PNG truecolor de 8 bits por canal, sin canal alfa. */
async function codificarPngRgb(
  ancho: number,
  alto: number,
  rgb: Uint8Array,
): Promise<Uint8Array> {
  const ihdr = new Uint8Array(13);
  const vista = new DataView(ihdr.buffer);
  vista.setUint32(0, ancho);
  vista.setUint32(4, alto);
  ihdr[8] = 8;
  ihdr[9] = 2; // truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const filas = new Uint8Array(alto * (1 + ancho * 3));
  let offset = 0;
  for (let y = 0; y < alto; y++) {
    filas[offset] = 0;
    offset += 1;
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 3;
      filas[offset] = rgb[i];
      filas[offset + 1] = rgb[i + 1];
      filas[offset + 2] = rgb[i + 2];
      offset += 3;
    }
  }

  const comprimido = await deflate(filas);
  return concatenar([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', comprimido),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/* --------------------------- Decodificación -------------------------- */

async function decodificarConNavegador(
  blob: Blob,
): Promise<ImagenDecodificada> {
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: 'from-image',
  } as ImageBitmapOptions);
  const lienzo =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : document.createElement('canvas');
  lienzo.width = bitmap.width;
  lienzo.height = bitmap.height;
  const contexto = lienzo.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!contexto || !('drawImage' in contexto)) {
    throw new ErrorValidacion('El navegador no puede procesar imágenes.');
  }
  contexto.drawImage(bitmap, 0, 0);
  const imagen = contexto.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close?.();
  return {
    ancho: bitmap.width,
    alto: bitmap.height,
    datos: imagen.data,
  };
}

/* --------------------------- Redimensión ----------------------------- */

function muestrearBilineal(
  imagen: ImagenDecodificada,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } {
  const x0 = Math.max(0, Math.min(imagen.ancho - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(imagen.alto - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(imagen.ancho - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(imagen.alto - 1, y0 + 1));
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));

  const pixel = (px: number, py: number) => {
    const i = (py * imagen.ancho + px) * 4;
    return {
      r: imagen.datos[i],
      g: imagen.datos[i + 1],
      b: imagen.datos[i + 2],
      a: imagen.datos[i + 3],
    };
  };
  const p00 = pixel(x0, y0);
  const p10 = pixel(x1, y0);
  const p01 = pixel(x0, y1);
  const p11 = pixel(x1, y1);
  const mezclar = (a: number, b: number): number => a + (b - a) * fx;
  const arriba = {
    r: mezclar(p00.r, p10.r),
    g: mezclar(p00.g, p10.g),
    b: mezclar(p00.b, p10.b),
    a: mezclar(p00.a, p10.a),
  };
  const abajo = {
    r: mezclar(p01.r, p11.r),
    g: mezclar(p01.g, p11.g),
    b: mezclar(p01.b, p11.b),
    a: mezclar(p01.a, p11.a),
  };
  return {
    r: arriba.r + (abajo.r - arriba.r) * fy,
    g: arriba.g + (abajo.g - arriba.g) * fy,
    b: arriba.b + (abajo.b - arriba.b) * fy,
    a: arriba.a + (abajo.a - arriba.a) * fy,
  };
}

/** Ajuste "contain" sobre fondo blanco, sin recortar ni deformar. */
function componerContain(
  imagen: ImagenDecodificada,
  tamano: number,
): Uint8Array {
  const rgb = new Uint8Array(tamano * tamano * 3).fill(255);
  const escala = Math.min(tamano / imagen.ancho, tamano / imagen.alto);
  const anchoDestino = Math.max(1, Math.round(imagen.ancho * escala));
  const altoDestino = Math.max(1, Math.round(imagen.alto * escala));
  const izquierda = Math.floor((tamano - anchoDestino) / 2);
  const arriba = Math.floor((tamano - altoDestino) / 2);

  for (let y = 0; y < altoDestino; y++) {
    const sy = ((y + 0.5) * imagen.alto) / altoDestino - 0.5;
    for (let x = 0; x < anchoDestino; x++) {
      const sx = ((x + 0.5) * imagen.ancho) / anchoDestino - 0.5;
      const muestra = muestrearBilineal(imagen, sx, sy);
      const alfa = muestra.a / 255;
      const i = ((arriba + y) * tamano + (izquierda + x)) * 3;
      rgb[i] = Math.round(muestra.r * alfa + 255 * (1 - alfa));
      rgb[i + 1] = Math.round(muestra.g * alfa + 255 * (1 - alfa));
      rgb[i + 2] = Math.round(muestra.b * alfa + 255 * (1 - alfa));
    }
  }
  return rgb;
}

/* ------------------------------- API -------------------------------- */

async function validarFirma(blob: Blob): Promise<void> {
  const cabecera = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const esJpeg = cabecera[0] === 0xff && cabecera[1] === 0xd8 && cabecera[2] === 0xff;
  const esPng =
    cabecera[0] === 0x89 &&
    cabecera[1] === 0x50 &&
    cabecera[2] === 0x4e &&
    cabecera[3] === 0x47;
  const esWebp =
    cabecera[0] === 0x52 &&
    cabecera[1] === 0x49 &&
    cabecera[2] === 0x46 &&
    cabecera[3] === 0x46 &&
    cabecera[8] === 0x57 &&
    cabecera[9] === 0x45 &&
    cabecera[10] === 0x42 &&
    cabecera[11] === 0x50;
  if (!esJpeg && !esPng && !esWebp) {
    throw new ErrorValidacion(
      'El archivo no es una imagen JPEG, PNG o WebP válida.',
      'comprobante',
    );
  }
}

function aHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * RN-I01 a RN-I03. Procesa la imagen en el dispositivo: corrige orientación
 * (el decodificador del navegador aplica EXIF), aplana la transparencia sobre
 * blanco, ajusta a `tamano`×`tamano` con "contain" y guarda PNG RGB 24 bits.
 */
export async function procesarComprobante(
  archivo: Blob,
  opciones: OpcionesProcesamiento = {},
): Promise<ComprobanteProcesado> {
  if (archivo.size <= 0) {
    throw new ErrorValidacion('El archivo está vacío.', 'comprobante');
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    throw new ErrorValidacion(
      'El comprobante supera el máximo de 5 MB.',
      'comprobante',
    );
  }
  await validarFirma(archivo);

  const tamano = opciones.tamano ?? 100;
  const decodificar = opciones.decodificar ?? decodificarConNavegador;
  let imagen: ImagenDecodificada;
  try {
    imagen = await decodificar(archivo);
  } catch {
    throw new ErrorValidacion(
      'No se pudo leer la imagen del comprobante.',
      'comprobante',
    );
  }
  if (imagen.ancho <= 0 || imagen.alto <= 0) {
    throw new ErrorValidacion(
      'La imagen del comprobante no es válida.',
      'comprobante',
    );
  }

  const rgb = componerContain(imagen, tamano);
  const png = await codificarPngRgb(tamano, tamano, rgb);
  const sha256 = aHex(
    await crypto.subtle.digest('SHA-256', aBlobPart(png)),
  );

  return {
    imagen: new Blob([aBlobPart(png)], { type: 'image/png' }),
    mimeType: 'image/png',
    ancho: tamano,
    alto: tamano,
    sha256,
  };
}

/** Devuelve la imagen del comprobante como base64 sin prefijo `data:`. */
export async function comprobanteABase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  const trozo = 0x8000;
  for (let i = 0; i < bytes.length; i += trozo) {
    binario += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + trozo, bytes.length)),
    );
  }
  return btoa(binario);
}
