import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/baseDatos';
import {
  actualizarSuscripcion,
  crearSuscripcion,
  detalleSuscripcion,
  listarSuscripciones,
  type DetalleSuscripcion,
} from '../../aplicacion/suscripciones';
import { mensajeDeError } from '../../dominio/errores';
import { formatearMoneda } from '../../dominio/dinero';
import { formatearFecha } from '../../dominio/fechas';
import type { Suscripcion } from '../../db/tipos';
import { Aviso, Cargando, Campo, Etiqueta, Vacio, colorEstadoSuscripcion } from '../componentes';

const FORMULARIO = {
  plataformaId: '',
  nombre: '',
  moneda: 'PEN',
  costo: '',
  capacidad: '1',
  diaCobro: '1',
  fechaInicio: '',
  esUsoPersonal: false,
};

export function Suscripciones() {
  const [formulario, setFormulario] = useState(FORMULARIO);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleSuscripcion | null>(null);
  const [editando, setEditando] = useState<Suscripcion | null>(null);
  const [edicion, setEdicion] = useState({
    nombre: '',
    costo: '',
    capacidad: '',
    diaCobro: '',
  });

  const plataformas = useLiveQuery(
    () => db.plataformas.toArray().then((p) => p.filter((x) => x.activo)),
    [],
    [],
  );
  const monedas = useLiveQuery(() => db.monedas.toArray(), [], []);
  const suscripciones = useLiveQuery(() => listarSuscripciones(db), [], []);

  function cambiar(campo: keyof typeof FORMULARIO, valor: string | boolean) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setMensaje(null);
    try {
      const creada = await crearSuscripcion(db, {
        plataformaId: formulario.plataformaId,
        nombre: formulario.nombre,
        moneda: formulario.moneda,
        costo: formulario.costo,
        capacidad: Number(formulario.capacidad),
        diaCobro: Number(formulario.diaCobro),
        fechaInicio: formulario.fechaInicio,
        esUsoPersonal: formulario.esUsoPersonal,
      });
      setMensaje(`Suscripción creada: ${creada.nombre}.`);
      setFormulario(FORMULARIO);
      setDetalle(await detalleSuscripcion(db, creada.id));
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  async function verDetalle(suscripcion: Suscripcion) {
    setError(null);
    try {
      setDetalle(await detalleSuscripcion(db, suscripcion.id));
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  function abrirEdicion(suscripcion: Suscripcion) {
    setEditando(suscripcion);
    setError(null);
    setEdicion({
      nombre: suscripcion.nombre,
      costo: (suscripcion.costoCentimos / 100).toFixed(2),
      capacidad: String(suscripcion.capacidad),
      diaCobro: String(suscripcion.diaCobro),
    });
  }

  async function guardarEdicion(evento: FormEvent) {
    evento.preventDefault();
    if (!editando) return;
    setError(null);
    try {
      await actualizarSuscripcion(db, editando.id, {
        nombre: edicion.nombre,
        costo: edicion.costo,
        capacidad: Number(edicion.capacidad),
        diaCobro: Number(edicion.diaCobro),
      });
      setMensaje(
        'Suscripción actualizada. El costo nuevo rige desde el siguiente periodo no generado.',
      );
      setEditando(null);
      if (detalle?.suscripcion.id === editando.id) {
        setDetalle(await detalleSuscripcion(db, editando.id));
      }
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  async function cambiarEstado(
    suscripcion: Suscripcion,
    estado: Suscripcion['estado'],
  ) {
    setError(null);
    try {
      await actualizarSuscripcion(db, suscripcion.id, { estado });
      setMensaje(`Suscripción "${suscripcion.nombre}" ahora está ${estado}.`);
      if (detalle?.suscripcion.id === suscripcion.id) {
        setDetalle(await detalleSuscripcion(db, suscripcion.id));
      }
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  return (
    <section className="pagina">
      <div className="pagina-encabezado">
        <div>
          <h1>Suscripciones</h1>
          <p>
            Define costo, capacidad y día de cobro. La cobertura compara lo
            acordado con los miembros activos contra el costo del servicio.
          </p>
        </div>
      </div>

      <article className="tarjeta">
        <h2>Nueva suscripción</h2>
        <form className="formulario" onSubmit={crear}>
          <Campo etiqueta="Plataforma *">
            <select
              value={formulario.plataformaId}
              onChange={(e) => cambiar('plataformaId', e.target.value)}
            >
              <option value="">Selecciona…</option>
              {plataformas?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Nombre *">
            <input
              value={formulario.nombre}
              onChange={(e) => cambiar('nombre', e.target.value)}
              placeholder="Plan familiar"
            />
          </Campo>
          <Campo etiqueta="Costo mensual *">
            <input
              inputMode="decimal"
              value={formulario.costo}
              onChange={(e) => cambiar('costo', e.target.value)}
              placeholder="53.90"
            />
          </Campo>
          <Campo etiqueta="Moneda">
            <select
              value={formulario.moneda}
              onChange={(e) => cambiar('moneda', e.target.value)}
            >
              {monedas?.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.codigo} · {m.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Capacidad (plazas) *">
            <input
              type="number"
              min={1}
              value={formulario.capacidad}
              onChange={(e) => cambiar('capacidad', e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Día de cobro *">
            <input
              type="number"
              min={1}
              max={31}
              value={formulario.diaCobro}
              onChange={(e) => cambiar('diaCobro', e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Fecha de inicio *">
            <input
              type="date"
              value={formulario.fechaInicio}
              onChange={(e) => cambiar('fechaInicio', e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Uso personal" ayuda="Egreso propio, sin alerta de pérdida.">
            <select
              value={formulario.esUsoPersonal ? 'SI' : 'NO'}
              onChange={(e) =>
                cambiar('esUsoPersonal', e.target.value === 'SI')
              }
            >
              <option value="NO">No</option>
              <option value="SI">Sí</option>
            </select>
          </Campo>

          <div className="ancho-completo acciones">
            <button className="boton boton-primario" type="submit">
              Crear suscripción
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

      {editando ? (
        <article className="tarjeta">
          <h2>Editar “{editando.nombre}”</h2>
          <form className="formulario" onSubmit={guardarEdicion}>
            <Campo etiqueta="Nombre">
              <input
                value={edicion.nombre}
                onChange={(e) =>
                  setEdicion((a) => ({ ...a, nombre: e.target.value }))
                }
              />
            </Campo>
            <Campo
              etiqueta="Costo mensual"
              ayuda="Los cargos ya generados no cambian."
            >
              <input
                inputMode="decimal"
                value={edicion.costo}
                onChange={(e) =>
                  setEdicion((a) => ({ ...a, costo: e.target.value }))
                }
              />
            </Campo>
            <Campo etiqueta="Capacidad">
              <input
                type="number"
                min={1}
                value={edicion.capacidad}
                onChange={(e) =>
                  setEdicion((a) => ({ ...a, capacidad: e.target.value }))
                }
              />
            </Campo>
            <Campo etiqueta="Día de cobro">
              <input
                type="number"
                min={1}
                max={31}
                value={edicion.diaCobro}
                onChange={(e) =>
                  setEdicion((a) => ({ ...a, diaCobro: e.target.value }))
                }
              />
            </Campo>
            <div className="ancho-completo acciones">
              <button className="boton boton-primario" type="submit">
                Guardar cambios
              </button>
              <button
                className="boton boton-secundario"
                type="button"
                onClick={() => setEditando(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </article>
      ) : null}

      {detalle ? (
        <article className="tarjeta">
          <div className="encabezado-tarjeta">
            <h2>
              {detalle.suscripcion.nombre} · {detalle.plataforma.nombre}
            </h2>
            <button
              className="boton boton-secundario boton-pequeno"
              type="button"
              onClick={() => setDetalle(null)}
            >
              Cerrar detalle
            </button>
          </div>
          <dl className="detalle-lista">
            <div>
              <dt>Costo mensual</dt>
              <dd>
                {formatearMoneda(
                  detalle.suscripcion.costoCentimos,
                  detalle.suscripcion.moneda,
                )}
              </dd>
            </div>
            <div>
              <dt>Costo por plaza</dt>
              <dd>
                {formatearMoneda(
                  detalle.costoPorPlazaCentimos,
                  detalle.suscripcion.moneda,
                )}
              </dd>
            </div>
            <div>
              <dt>Plazas</dt>
              <dd>
                {detalle.plazasOcupadas} ocupadas · {detalle.plazasLibres} libres
              </dd>
            </div>
            <div>
              <dt>Cobertura</dt>
              <dd>
                {formatearMoneda(
                  detalle.coberturaCentimos,
                  detalle.suscripcion.moneda,
                )}
              </dd>
            </div>
            <div>
              <dt>Cobrado del periodo</dt>
              <dd>
                {formatearMoneda(
                  detalle.cobradoCentimos,
                  detalle.suscripcion.moneda,
                )}{' '}
                de{' '}
                {formatearMoneda(
                  detalle.esperadoCentimos,
                  detalle.suscripcion.moneda,
                )}
              </dd>
            </div>
            <div>
              <dt>Fecha de inicio</dt>
              <dd>{formatearFecha(detalle.suscripcion.fechaInicio)}</dd>
            </div>
          </dl>
          {detalle.enDeficit ? (
            <div style={{ marginTop: '0.8rem' }}>
              <Aviso tipo="alerta">
                Déficit proyectado: lo acordado no cubre el costo de la
                suscripción.
              </Aviso>
            </div>
          ) : null}
        </article>
      ) : null}

      <article className="tarjeta">
        <div className="encabezado-tarjeta">
          <h2>Suscripciones registradas</h2>
          <span className="nota">{suscripciones?.length ?? 0} en total</span>
        </div>

        {suscripciones === undefined ? (
          <Cargando />
        ) : suscripciones.length === 0 ? (
          <Vacio>Aún no hay suscripciones.</Vacio>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Suscripción</th>
                  <th>Plataforma</th>
                  <th className="numero">Costo</th>
                  <th>Plazas</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {suscripciones.map((suscripcion) => (
                  <tr key={suscripcion.id}>
                    <td>
                      <strong>{suscripcion.nombre}</strong>
                      {suscripcion.esUsoPersonal ? (
                        <div>
                          <Etiqueta color="azul">USO PERSONAL</Etiqueta>
                        </div>
                      ) : null}
                    </td>
                    <td>{suscripcion.plataforma}</td>
                    <td className="numero">
                      {formatearMoneda(
                        suscripcion.costoCentimos,
                        suscripcion.moneda,
                      )}
                    </td>
                    <td>{suscripcion.capacidad}</td>
                    <td>
                      <Etiqueta color={colorEstadoSuscripcion(suscripcion.estado)}>
                        {suscripcion.estado}
                      </Etiqueta>
                    </td>
                    <td>
                      <div className="grilla-inline">
                        <button
                          className="boton boton-secundario boton-pequeno"
                          type="button"
                          onClick={() => verDetalle(suscripcion)}
                        >
                          Detalle
                        </button>
                        <button
                          className="boton boton-secundario boton-pequeno"
                          type="button"
                          onClick={() => abrirEdicion(suscripcion)}
                        >
                          Editar
                        </button>
                        {suscripcion.estado !== 'ACTIVA' ? (
                          <button
                            className="boton boton-secundario boton-pequeno"
                            type="button"
                            onClick={() => cambiarEstado(suscripcion, 'ACTIVA')}
                          >
                            Activar
                          </button>
                        ) : (
                          <button
                            className="boton boton-secundario boton-pequeno"
                            type="button"
                            onClick={() =>
                              cambiarEstado(suscripcion, 'SUSPENDIDA')
                            }
                          >
                            Suspender
                          </button>
                        )}
                        {suscripcion.estado !== 'CANCELADA' ? (
                          <button
                            className="boton boton-peligro boton-pequeno"
                            type="button"
                            onClick={() =>
                              cambiarEstado(suscripcion, 'CANCELADA')
                            }
                          >
                            Cancelar
                          </button>
                        ) : null}
                      </div>
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
