/** Serializa bytes a Base64 sin prefijo `data:` para el paquete JSON. */
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
