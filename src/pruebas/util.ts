import Dexie from 'dexie';
import { crearBaseDeDatos, type BaseDatos } from '../db/baseDatos';
import { asegurarSemilla } from '../db/semilla';

let contador = 0;

/** Base aislada por prueba, con catálogos sembrados. */
export async function baseTemporal(): Promise<BaseDatos> {
  contador += 1;
  const nombre = `qorigo-prueba-${Date.now()}-${contador}`;
  const db = crearBaseDeDatos(nombre);
  await asegurarSemilla(db);
  return db;
}

export async function destruirBase(db: BaseDatos): Promise<void> {
  db.close();
  await Dexie.delete(db.name);
}
