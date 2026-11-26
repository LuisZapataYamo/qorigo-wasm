import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../infraestructura/persistencia/baseDatos';
import { sesionActual } from '../aplicacion/sesion';
import { Disposicion } from './Disposicion';
import { PantallaAcceso } from './paginas/PantallaAcceso';

export function ProteccionLocal() {
  const requiereAcceso = useLiveQuery(
    async () =>
      (await db.configuracion.get('acceso_configurado'))?.valor === 'SI',
    [],
  );
  const sesion = useLiveQuery(() => sesionActual(db), []);

  if (requiereAcceso === undefined || sesion === undefined) {
    return <div className="pantalla-bloqueo">Cargando…</div>;
  }

  if (requiereAcceso && !sesion) {
    return <PantallaAcceso />;
  }

  return <Disposicion />;
}
