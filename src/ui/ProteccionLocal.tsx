import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/baseDatos';
import { sesionActual } from '../aplicacion/sesion';
import { Disposicion } from './Disposicion';
import { PantallaAcceso } from './paginas/PantallaAcceso';

export function ProteccionLocal() {
  const configurado = useLiveQuery(
    () => db.configuracion.get('acceso_configurado'),
    [],
  );
  const sesion = useLiveQuery(() => sesionActual(db), []);

  if (configurado === undefined || sesion === undefined) {
    return <div className="pantalla-bloqueo">Cargando…</div>;
  }

  if (configurado?.valor === 'SI' && !sesion) {
    return <PantallaAcceso />;
  }

  return <Disposicion />;
}
