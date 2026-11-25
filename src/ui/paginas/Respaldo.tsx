import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/baseDatos';
import {
  ADVERTENCIA_EXPORTACION,
  exportarDatos,
  nombreArchivoExportacion,
  serializarPaquete,
} from '../../aplicacion/respaldo';
import {
  importarDatos,
  previsualizarImportacion,
  type PrevisualizacionImportacion,
} from '../../aplicacion/importacion';
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
  const [paqueteImportado, setPaqueteImportado] = useState<unknown>(null);
  const [preview, setPreview] = useState<PrevisualizacionImportacion | null>(
    null,
  );
  const [modo, setModo] = useState<'REEMPLAZAR' | 'COMBINAR'>('COMBINAR');
  const [importando, setImportando] = useState(false);
  const [mensajeImportacion, setMensajeImportacion] = useState<string | null>(
    null,
  );
  const [errorImportacion, setErrorImportacion] = useState<string | null>(null);

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

  async function seleccionarArchivo(archivo: File | null) {
    setPreview(null);
    setPaqueteImportado(null);
    setMensajeImportacion(null);
    setErrorImportacion(null);
    if (!archivo) return;
    try {
      const texto = await archivo.text();
      const datos = JSON.parse(texto) as unknown;
      const vista = previsualizarImportacion(datos);
      setPreview(vista);
      setPaqueteImportado(datos);
      if (!vista.valido) {
        setErrorImportacion(
          'El archivo no es válido. Revisa los errores antes de continuar.',
        );
      }
    } catch {
      setErrorImportacion('El archivo no contiene JSON válido.');
    }
  }

  async function importar() {
    if (!paqueteImportado || !preview?.valido) return;
    if (
      modo === 'REEMPLAZAR' &&
      !window.confirm(
        'Se reemplazarán todos los datos de negocio de este dispositivo. Se recomienda exportar una copia antes. ¿Continuar?',
      )
    ) {
      return;
    }
    setImportando(true);
    setErrorImportacion(null);
    setMensajeImportacion(null);
    try {
      const resultado = await importarDatos(db, paqueteImportado, { modo });
      const totalImportado = Object.values(resultado.importados).reduce(
        (a, b) => a + b,
        0,
      );
      const totalOmitido = Object.values(resultado.omitidos).reduce(
        (a, b) => a + b,
        0,
      );
      setMensajeImportacion(
        `Importación ${modo.toLowerCase()} completada: ${totalImportado} registro(s) importado(s)` +
          (totalOmitido > 0 ? `, ${totalOmitido} ya existente(s) omitido(s).` : '.'),
      );
    } catch (fallo) {
      setErrorImportacion(mensajeDeError(fallo));
    } finally {
      setImportando(false);
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

      <article className="tarjeta">
        <h2>Importar</h2>
        <p className="nota">
          Selecciona un JSON exportado desde QoriGo. Se valida antes de escribir:
          nada cambia hasta que confirmes.
        </p>
        <div className="campo">
          <span>Archivo JSON</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              void seleccionarArchivo(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </div>

        {preview ? (
          <div style={{ marginTop: '0.9rem' }}>
            <Aviso tipo={preview.valido ? 'exito' : 'error'}>
              <div>
                <strong>
                  {preview.valido
                    ? 'Paquete válido'
                    : 'Paquete inválido'}
                </strong>
                <p style={{ margin: '0.25rem 0' }}>
                  Formato {preview.formato ?? '—'} · versión{' '}
                  {preview.formatVersion ?? '—'} · exportado{' '}
                  {preview.exportedAt
                    ? new Date(preview.exportedAt).toLocaleString('es-PE')
                    : '—'}
                </p>
                <p style={{ margin: '0.25rem 0' }}>
                  {preview.conteos.personas ?? 0} personas ·{' '}
                  {preview.conteos.suscripciones ?? 0} suscripciones ·{' '}
                  {preview.conteos.prestamos ?? 0} préstamos ·{' '}
                  {preview.conteos.pagos ?? 0} pagos ·{' '}
                  {preview.conteos.comprobantes ?? 0} comprobantes
                </p>
                {preview.errores.length > 0 ? (
                  <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>
                    {preview.errores.slice(0, 8).map((mensajeError) => (
                      <li key={mensajeError}>{mensajeError}</li>
                    ))}
                  </ul>
                ) : null}
                {preview.advertencias.length > 0 ? (
                  <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>
                    {preview.advertencias.map((advertencia) => (
                      <li key={advertencia}>{advertencia}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Aviso>

            <div className="fila-filtros" style={{ marginTop: '0.8rem' }}>
              <label className="campo">
                <span>Modo</span>
                <select
                  value={modo}
                  onChange={(e) =>
                    setModo(e.target.value as 'REEMPLAZAR' | 'COMBINAR')
                  }
                >
                  <option value="COMBINAR">Combinar datos</option>
                  <option value="REEMPLAZAR">Reemplazar datos locales</option>
                </select>
              </label>
              <button
                className="boton boton-primario"
                type="button"
                disabled={!preview.valido || importando}
                onClick={() => void importar()}
              >
                {importando ? 'Importando…' : 'Importar datos'}
              </button>
            </div>
            <p className="nota">
              Combinar incorpora solo UUID nuevos. Si un UUID existe con otro
              contenido, la importación se cancela sin sobrescribir. Reemplazar
              sustituye todo el conjunto de datos de negocio.
            </p>
          </div>
        ) : null}

        {errorImportacion ? (
          <div style={{ marginTop: '0.7rem' }}>
            <Aviso tipo="error">{errorImportacion}</Aviso>
          </div>
        ) : null}
        {mensajeImportacion ? (
          <div style={{ marginTop: '0.7rem' }}>
            <Aviso tipo="exito">{mensajeImportacion}</Aviso>
          </div>
        ) : null}
      </article>
    </section>
  );
}
