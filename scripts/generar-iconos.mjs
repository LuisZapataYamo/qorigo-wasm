import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = resolve(AQUI, '..', 'public');

const CRC_TABLA = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(datos) {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = CRC_TABLA[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([largo, cuerpo, crc]);
}

function pngRgb(ancho, alto, pixeles) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // truecolor RGB
  const filas = [];
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 3);
    fila[0] = 0;
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 3;
      fila[1 + x * 3] = pixeles[i];
      fila[2 + x * 3] = pixeles[i + 1];
      fila[3 + x * 3] = pixeles[i + 2];
    }
    filas.push(fila);
  }
  const idat = deflateSync(Buffer.concat(filas), { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function dibujarIcono(tamano) {
  const pixeles = new Uint8Array(tamano * tamano * 3);
  const fondo = [180, 83, 9];
  const blanco = [255, 251, 235];
  const centro = (tamano - 1) / 2;
  const radioExterior = tamano * 0.3;
  const grosor = tamano * 0.085;
  const radioInterior = radioExterior - grosor;
  const radioEsquina = tamano * 0.2;

  for (let y = 0; y < tamano; y++) {
    for (let x = 0; x < tamano; x++) {
      const i = (y * tamano + x) * 3;
      const dx = Math.max(Math.abs(x - centro) - (tamano / 2 - radioEsquina), 0);
      const dy = Math.max(Math.abs(y - centro) - (tamano / 2 - radioEsquina), 0);
      const enTarjeta = dx * dx + dy * dy <= radioEsquina * radioEsquina;
      const color = enTarjeta ? fondo : [255, 251, 235];
      const dist = Math.hypot(x - centro, y - centro);
      let esTrazo = dist <= radioExterior && dist >= radioInterior;
      // Cola de la Q: trazo diagonal hacia abajo-derecha.
      const tx = x - (centro + tamano * 0.12);
      const ty = y - (centro + tamano * 0.12);
      const enCola =
        tx >= 0 &&
        ty >= 0 &&
        Math.abs(tx - ty) <= grosor * 0.75 &&
        Math.hypot(tx, ty) <= radioExterior * 0.72;
      esTrazo = esTrazo || enCola;
      const rgb = esTrazo ? blanco : color;
      pixeles[i] = rgb[0];
      pixeles[i + 1] = rgb[1];
      pixeles[i + 2] = rgb[2];
    }
  }
  return pngRgb(tamano, tamano, pixeles);
}

mkdirSync(SALIDA, { recursive: true });
for (const tamano of [192, 512]) {
  writeFileSync(resolve(SALIDA, `icono-${tamano}.png`), dibujarIcono(tamano));
}
writeFileSync(
  resolve(SALIDA, 'favicon.svg'),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#b45309"/><circle cx="32" cy="32" r="18" fill="none" stroke="#fffbeb" stroke-width="6"/><path d="M38 38l8 8" stroke="#fffbeb" stroke-width="6" stroke-linecap="round"/></svg>',
);
console.log('Iconos generados en public/');
