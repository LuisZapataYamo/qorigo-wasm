import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/baseDatos';
import {
  ADVERTENCIA_EXPORTACION,
  exportarDatos,
  nombreArchivoExportacion,
  serializarPaquete,
} from '../../aplicacion/respaldo';
import { mensajeDeError } from '../../dominio/errores';
import { Aviso } from '../componentes';

function descargarJson(nombre: string, contenido: string) {
  const blob = new Blob([contenido], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

export function Respaldo() {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const conteos = useLiveQuery(async () => {
    const [
      personas,
      suscripciones,
      prestamos,
      pagos,
      comprobantes,
      auditoria,
    ] = await Promise.all([
      db.personas.count(),
      db.suscripciones.count(),
      db.prestamos.count(),
      db.pagos.count(),
      db.comprobantesPago.count(),
      db.auditoria.count(),
    ]);
    return {
      personas,
      suscripciones,
      prestamos,
      pagos,
      comprobantes,
      auditoria,
    };
  }, []);

  async function exportar() {
    setError(null);
    setMensaje(null);
    setExportando(true);
    try {
      const paquete = await exportarDatos(db);
      descargarJson(
        nombreArchivoExportacion(),
        serializarPaquete(paquete),
      );
      setMensaje(
        'Exportación lista. Guarda el archivo en un lugar seguro; no se envió a ningún servidor.',
      );
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setExportando(false);
    }
  }

  return (
    <section className="pagina">
      <div className="pagina-encabezado">
        <div>
          <h1>Respaldo e intercambio</h1>
          <p>
            Exporta un JSON con todos los datos de negocio para conservar una
            copia o abrir la misma información en otra instalación. La
            transferencia es manual: no hay sincronización automática.
          </p>
        </div>
      </div>

      <article className="tarjeta">
        <h2>Exportar</h2>
        <Aviso tipo="alerta">{ADVERTENCIA_EXPORTACION}</Aviso>

        <dl className="detalle-lista" style={{ marginTop: '0.8rem' }}>
          <div>
            <dt>Personas</dt>
            <dd>{conteos?.personas ?? 0}</dd>
          </div>
          <div>
            <dt>Suscripciones</dt>
            <dd>{conteos?.suscripciones ?? 0}</dd>
          </div>
          <div>
            <dt>Préstamos</dt>
            <dd>{conteos?.prestamos ?? 0}</dd>
          </div>
          <div>
            <dt>Pagos</dt>
            <dd>{conteos?.pagos ?? 0}</dd>
          </div>
          <div>
            <dt>Comprobantes</dt>
            <dd>{conteos?.comprobantes ?? 0}</dd>
          </div>
          <div>
            <dt>Registros de auditoría</dt>
            <dd>{conteos?.auditoria ?? 0}</dd>
          </div>
        </dl>

        <div className="acciones" style={{ marginTop: '0.9rem' }}>
          <button
            className="boton boton-primario"
            type="button"
            onClick={() => void exportar()}
            disabled={exportando}
          >
            {exportando ? 'Generando…' : 'Exportar datos a JSON'}
          </button>
        </div>

        {error ? (
          <div style={{ marginTop: '0.7rem' }}>
            <Aviso tipo="error">{error}</Aviso>
          </div>
        ) : null}
        {mensaje ? (
          <div style={{ marginTop: '0.7rem' }}>
            <Aviso tipo="exito">{mensaje}</Aviso>
          </div>
        ) : null}

        <p className="nota" style={{ marginTop: '0.8rem' }}>
          El paquete incluye UUID, relaciones y comprobantes en Base64. No
          incluye contraseñas, sesiones ni la configuración de acceso local,
          que pertenecen a este dispositivo.
        </p>
      </article>
    </section>
  );
}
