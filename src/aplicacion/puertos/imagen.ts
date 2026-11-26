export interface ComprobanteProcesado {
  imagen: Blob;
  mimeType: string;
  ancho: number;
  alto: number;
  sha256: string;
}

/** Puerto para procesar imágenes en el adaptador (Canvas, sharp, etc.). */
export interface ProcesadorImagen {
  procesar(archivo: Blob): Promise<ComprobanteProcesado>;
}
