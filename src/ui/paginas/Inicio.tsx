import { NavLink } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/baseDatos';
import { formatearMoneda } from '../../dominio/dinero';

export function Inicio() {
  const resumen = useLiveQuery(async () => {
    const [personas, suscripciones, prestamos, pagos] = await Promise.all([
      db.personas.count(),
      db.suscripciones.count(),
      db.prestamos.count(),
      db.pagos.count(),
    ]);
    const moneda =
      (await db.configuracion.get('moneda_por_defecto'))?.valor ?? 'PEN';
    return { personas, suscripciones, prestamos, pagos, moneda };
  }, []);

  return (
    <section className="pagina">
      <div className="pagina-encabezado">
        <div>
          <h1>Tu información, en tu dispositivo</h1>
          <p>
            QoriGo funciona sin servidor. Todo lo que registres se guarda en
            IndexedDB y solo se comparte si exportas una copia JSON.
          </p>
        </div>
      </div>

      <div className="rejilla-metricas">
        <article className="metrica">
          <span>Personas</span>
          <strong>{resumen?.personas ?? 0}</strong>
        </article>
        <article className="metrica">
          <span>Suscripciones</span>
          <strong>{resumen?.suscripciones ?? 0}</strong>
        </article>
        <article className="metrica">
          <span>Préstamos</span>
          <strong>{resumen?.prestamos ?? 0}</strong>
        </article>
        <article className="metrica">
          <span>Pagos</span>
          <strong>{resumen?.pagos ?? 0}</strong>
        </article>
      </div>

      <div className="rejilla-dos">
        <article className="tarjeta">
          <h2>Primeros pasos</h2>
          <ol className="lista-pasos">
            <li>
              <NavLink to="/personas">Registra personas</NavLink> que pagarán
              suscripciones o recibirán préstamos.
            </li>
            <li>
              <NavLink to="/suscripciones">Crea tus suscripciones</NavLink> y
              agrega miembros con su monto acordado.
            </li>
            <li>
              <NavLink to="/prestamos">Registra préstamos</NavLink>; el
              cronograma de cuotas se genera solo.
            </li>
            <li>
              <NavLink to="/pagos">Cobra pagos</NavLink> y adjunta el
              comprobante.
            </li>
          </ol>
        </article>

        <article className="tarjeta">
          <h2>Respaldo manual</h2>
          <p>
            Los datos viven únicamente en este navegador. Si borras los datos
            del sitio o desinstalas la aplicación, se pierden.
          </p>
          <p>
            Exporta un JSON desde <NavLink to="/respaldo">Respaldo</NavLink> y
            guárdalo en un lugar seguro. Ese archivo te permite ver la misma
            información en otro dispositivo.
          </p>
          <p className="nota">
            Moneda por defecto: <strong>{resumen?.moneda ?? 'PEN'}</strong> ·{' '}
            {formatearMoneda(0, resumen?.moneda ?? 'PEN')} de ejemplo de
            formato.
          </p>
        </article>
      </div>
    </section>
  );
}
