import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../infraestructura/persistencia/baseDatos';
import { formatearMoneda } from '../../dominio/dinero';
import {
  estimarAlmacenamiento,
  formatearBytes,
  persistenciaDisponible,
  solicitarPersistencia,
} from '../../infraestructura/navegador/almacenamiento';
import { Aviso } from '../componentes';

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export function Inicio() {
  const [eventoInstalacion, setEventoInstalacion] =
    useState<EventoInstalacion | null>(null);
  const [mensajeAlmacenamiento, setMensajeAlmacenamiento] = useState<
    string | null
  >(null);

  useEffect(() => {
    const escuchar = (evento: Event) => {
      evento.preventDefault();
      setEventoInstalacion(evento as EventoInstalacion);
    };
    window.addEventListener('beforeinstallprompt', escuchar);
    return () => window.removeEventListener('beforeinstallprompt', escuchar);
  }, []);

  async function pedirPersistencia() {
    const concedida = await solicitarPersistencia();
    const estimacion = await estimarAlmacenamiento();
    setMensajeAlmacenamiento(
      concedida
        ? 'El navegador aceptó conservar los datos de forma persistente.'
        : 'El navegador no concedió persistencia. Exporta respaldos con frecuencia.' +
            (estimacion
              ? ` Uso actual: ${formatearBytes(estimacion.usoBytes)} de ${formatearBytes(estimacion.cuotaBytes)}.`
              : ''),
    );
  }

  async function instalar() {
    if (!eventoInstalacion) return;
    await eventoInstalacion.prompt();
    setEventoInstalacion(null);
  }
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

        <article className="tarjeta">
          <h2>Aplicación instalable</h2>
          <p>
            QoriGo es una PWA: se instala desde el navegador y funciona sin
            conexión después de la primera carga. En Android usa el menú del
            navegador → “Instalar aplicación”.
          </p>
          <div className="acciones">
            {eventoInstalacion ? (
              <button
                className="boton boton-primario"
                type="button"
                onClick={() => void instalar()}
              >
                Instalar QoriGo
              </button>
            ) : (
              <span className="nota">
                Si no aparece el instalador, usa el menú del navegador.
              </span>
            )}
          </div>
          <hr className="separador" />
          <p className="nota">
            El navegador puede borrar datos locales si necesita espacio. Puedes
            pedirle que los conserve de forma persistente.
          </p>
          <div className="acciones">
            <button
              className="boton boton-secundario boton-pequeno"
              type="button"
              onClick={() => void pedirPersistencia()}
            >
              {persistenciaDisponible()
                ? 'Solicitar almacenamiento persistente'
                : 'Comprobar almacenamiento'}
            </button>
          </div>
          {mensajeAlmacenamiento ? (
            <div style={{ marginTop: '0.6rem' }}>
              <Aviso tipo="info">{mensajeAlmacenamiento}</Aviso>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}
