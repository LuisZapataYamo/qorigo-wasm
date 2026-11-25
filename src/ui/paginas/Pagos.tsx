import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/baseDatos';
import {
  obtenerObligacionesPendientes,
  registrarPago,
} from '../../aplicacion/pagos';
import {
  procesarComprobante,
  type ComprobanteProcesado,
} from '../../aplicacion/comprobantes';
import { aCentimos, aSoles, formatearMoneda } from '../../dominio/dinero';
import { formatearFecha, hoy } from '../../dominio/fechas';
import { ErrorConflicto, mensajeDeError } from '../../dominio/errores';import { nombreCompleto } from '../../dominio/nombres';
import type { ObligacionPendiente, TipoObligacion } from '../../db/tipos';
import { Aviso, Campo, Etiqueta, Vacio } from '../componentes';

export function Pagos() {
  const [personaId, setPersonaId] = useState('');
  const [tipo, setTipo] = useState<TipoObligacion>('SUSCRIPCION');
  const [moneda, setMoneda] = useState('PEN');
  const [monto, setMonto] = useState('');
  const [fechaPago, setFechaPago] = useState(hoy());
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [referencia, setReferencia] = useState('');
  const [observacion, setObservacion] = useState('');
  const [reparto, setReparto] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [refresco, setRefresco] = useState(0);
  const [comprobantes, setComprobantes] = useState<ComprobanteProcesado[]>([]);
  const [procesandoImagen, setProcesandoImagen] = useState(false);

  const personas = useLiveQuery(
    () =>
      db.personas.toArray().then((lista) =>
        lista
          .filter((p) => p.activo)
          .sort((a, b) =>
            nombreCompleto(a.apellidos, a.nombres).localeCompare(
              nombreCompleto(b.apellidos, b.nombres),
              'es',
            ),
          ),
      ),
    [],
    [],
  );

  const monedas = useLiveQuery(() => db.monedas.toArray(), [], []);

  const obligaciones = useLiveQuery(
    () =>
      personaId
        ? obtenerObligacionesPendientes(db, personaId, tipo)
        : Promise.resolve<ObligacionPendiente[]>([]),
    [personaId, tipo, refresco],
    [],
  );

  const metodos = useLiveQuery(
    () =>
      db.configuracion
        .get('metodos_pago')
        .then((c) => c?.valor.split(',').map((m) => m.trim()) ?? []),
    [],
    [],
  );
  const listaMetodos =
    metodos && metodos.length > 0
      ? metodos
      : ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA'];

  function sugerir() {
    const total = Number(monto);
    if (!Number.isFinite(total) || total <= 0) return;
    let restante = aCentimos(total);
    const nuevo: Record<string, string> = {};
    for (const obligacion of obligaciones ?? []) {
      if (obligacion.moneda !== moneda) continue;
      if (restante <= 0) break;
      const aplicar = Math.min(obligacion.saldoCentimos, restante);
      nuevo[obligacion.id] = aSoles(aplicar).toFixed(2);
      restante -= aplicar;
    }
    setReparto(nuevo);
  }

  async function agregarComprobantes(archivos: FileList | null) {
    if (!archivos || archivos.length === 0) return;
    setError(null);
    setProcesandoImagen(true);
    try {
      const nuevos = [...comprobantes];
      for (const archivo of Array.from(archivos)) {
        if (nuevos.length >= 3) {
          setError('Se permiten como máximo 3 comprobantes por pago.');
          break;
        }
        const procesado = await procesarComprobante(archivo);
        if (!nuevos.some((c) => c.sha256 === procesado.sha256)) {
          nuevos.push(procesado);
        } else {
          setError('Ese comprobante ya está adjunto en este pago.');
        }
      }
      setComprobantes(nuevos);
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setProcesandoImagen(false);
    }
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setMensaje(null);
    try {
      const aplicaciones = Object.entries(reparto)
        .filter(([, valor]) => Number(valor) > 0)
        .map(([obligacionId, valor]) => {
          const obligacion = (obligaciones ?? []).find(
            (o) => o.id === obligacionId,
          )!;
          return {
            tipo: obligacion.tipo,
            obligacionId,
            monto: valor,
          };
        });

      const entrada = {
        personaId,
        moneda,
        fechaPago,
        monto,
        metodoPago,
        referencia,
        observacion,
        aplicaciones: aplicaciones.length > 0 ? aplicaciones : undefined,
        comprobantes,
      };

      let resultado;
      try {
        resultado = await registrarPago(db, entrada);
      } catch (fallo) {
        if (
          fallo instanceof ErrorConflicto &&
          window.confirm(
            'Ya existe un comprobante idéntico. ¿Registrarlo de todos modos?',
          )
        ) {
          resultado = await registrarPago(db, entrada, {
            confirmarDuplicado: true,
          });
        } else {
          throw fallo;
        }
      }

      setMensaje(
        `Pago registrado por ${formatearMoneda(resultado.pago.montoCentimos, moneda)}.` +
          (resultado.remanenteCentimos > 0
            ? ` Quedan ${formatearMoneda(resultado.remanenteCentimos, moneda)} sin aplicar.`
            : ''),
      );
      setMonto('');
      setReparto({});
      setReferencia('');
      setObservacion('');
      setComprobantes([]);
      setRefresco((n) => n + 1);
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  return (
    <section className="pagina">
      <div className="pagina-encabezado">
        <div>
          <h1>Pagos</h1>
          <p>
            El pago se aplica primero a lo más vencido. Puedes ajustar el
            reparto por obligación antes de guardar.
          </p>
        </div>
      </div>

      <article className="tarjeta">
        <h2>Datos del pago</h2>
        <form className="formulario" onSubmit={guardar}>
          <Campo etiqueta="Persona *">
            <select
              value={personaId}
              onChange={(e) => {
                setPersonaId(e.target.value);
                setReparto({});
              }}
            >
              <option value="">Selecciona…</option>
              {(personas ?? []).map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {nombreCompleto(persona.apellidos, persona.nombres)}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Tipo *">
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as TipoObligacion);
                setReparto({});
              }}
            >
              <option value="SUSCRIPCION">Suscripción</option>
              <option value="PRESTAMO">Préstamo</option>
            </select>
          </Campo>
          <Campo etiqueta="Monto *">
            <input
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="15.00"
            />
          </Campo>
          <Campo etiqueta="Moneda">
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
            >
              {(monedas ?? []).map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.codigo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Fecha *">
            <input
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Método *">
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              {listaMetodos.map((metodo) => (
                <option key={metodo} value={metodo}>
                  {metodo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Referencia" ayuda="Número de operación del voucher.">
            <input
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Observación">
            <input
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
            />
          </Campo>

          <div className="ancho-completo campo">
            <span>Comprobante (máximo 3)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => {
                void agregarComprobantes(e.target.files);
                e.target.value = '';
              }}
              disabled={procesandoImagen}
            />
            <small>
              {procesandoImagen
                ? 'Procesando imagen…'
                : 'JPEG, PNG o WebP hasta 5 MB. Se guarda como PNG de 100×100 sin salir del dispositivo.'}
            </small>
          </div>

          {comprobantes.length > 0 ? (
            <div className="ancho-completo">
              <div className="acciones">
                {comprobantes.map((comprobante) => (
                  <div key={comprobante.sha256} style={{ textAlign: 'center' }}>
                    <img
                      src={URL.createObjectURL(comprobante.imagen)}
                      alt="Comprobante"
                      width={90}
                      height={90}
                      style={{
                        borderRadius: 8,
                        border: '1px solid #e7e5e4',
                        background: '#fff',
                      }}
                    />
                    <div>
                      <button
                        className="boton boton-peligro boton-pequeno"
                        type="button"
                        onClick={() =>
                          setComprobantes((actual) =>
                            actual.filter(
                              (c) => c.sha256 !== comprobante.sha256,
                            ),
                          )
                        }
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="ancho-completo acciones">
            <button
              className="boton boton-secundario"
              type="button"
              onClick={sugerir}
            >
              Aplicar por antigüedad
            </button>
            <button
              className="boton boton-primario"
              type="submit"
              disabled={!personaId}
            >
              Registrar pago
            </button>
          </div>

          {error ? (
            <div className="ancho-completo">
              <Aviso tipo="error">{error}</Aviso>
            </div>
          ) : null}
          {mensaje ? (
            <div className="ancho-completo">
              <Aviso tipo="exito">{mensaje}</Aviso>
            </div>
          ) : null}
        </form>
      </article>

      <article className="tarjeta">
        <div className="encabezado-tarjeta">
          <h2>Obligaciones pendientes</h2>
          <span className="nota">
            {obligaciones?.length ?? 0} pendiente(s)
          </span>
        </div>

        {!personaId ? (
          <Vacio>Selecciona una persona para ver sus obligaciones.</Vacio>
        ) : (obligaciones ?? []).length === 0 ? (
          <Vacio>No hay obligaciones pendientes de este tipo.</Vacio>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Vencimiento</th>
                  <th className="numero">Saldo</th>
                  <th>Estado</th>
                  <th className="numero">Aplicar</th>
                </tr>
              </thead>
              <tbody>
                {(obligaciones ?? []).map((obligacion) => (
                  <tr key={obligacion.id}>
                    <td>{obligacion.concepto}</td>
                    <td>{formatearFecha(obligacion.fechaVencimiento)}</td>
                    <td className="numero">
                      {formatearMoneda(
                        obligacion.saldoCentimos,
                        obligacion.moneda,
                      )}
                    </td>
                    <td>
                      {obligacion.saldoCentimos < obligacion.montoCentimos ? (
                        <Etiqueta color="ambar">PARCIAL</Etiqueta>
                      ) : (
                        <Etiqueta>PENDIENTE</Etiqueta>
                      )}
                    </td>
                    <td className="numero">
                      <input
                        style={{ maxWidth: 110 }}
                        inputMode="decimal"
                        value={reparto[obligacion.id] ?? ''}
                        onChange={(e) =>
                          setReparto((actual) => ({
                            ...actual,
                            [obligacion.id]: e.target.value,
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
