import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { fijarHoy } from '../dominio/fechas';

// Node no trae IndexedDB; fake-indexeddb permite probar el mismo código
// que se ejecuta en el navegador contra una base real en memoria.
afterEach(() => {
  fijarHoy(null);
});
