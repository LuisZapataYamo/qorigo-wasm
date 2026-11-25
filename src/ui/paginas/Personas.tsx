import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/baseDatos';
import {
  ErrorDocumentoDuplicado,
  consultarFichaPersona,
  desactivarPersona,
  editarPersona,
  eliminarPersona,
  listarPersonas,
  reactivarPersona,
  registrarPersona,
  type EntradaPersona,
  type FichaPersona,
  type FiltroEstadoPersona,
} from '../../aplicacion/personas';
import { mensajeDeError } from '../../dominio/errores';
import { formatearMoneda } from '../../dominio/dinero';
import { formatearFecha } from '../../dominio/fechas';
import { nombreCompleto } from '../../dominio/nombres';
import type { Persona } from '../../db/tipos';
import { Aviso, Cargando, Campo, Etiqueta, Vacio } from '../componentes';

const FORMULARIO_VACIO: EntradaPersona = {
  nombres: '',
  apellidos: '',
  documento: '',
  telefono: '',
  email: '',
  direccion: '',
};

const TAMANO_PAGINA = 10;

export function Personas() {
  const [formulario, setFormulario] = useState<EntradaPersona>(FORMULARIO_VACIO);
  const [similares, setSimilares] = useState<Persona[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaPersona | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<FiltroEstadoPersona>('TODAS');
  const [pagina, setPagina] = useState(1);

  const lista = useLiveQuery(
    () => listarPersonas(db, { busqueda, estado, pagina, tamano: TAMANO_PAGINA }),
    [busqueda, estado, pagina],
  );

  function cambiar(campo: keyof EntradaPersona, valor: string) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  function limpiarFormulario() {
    setFormulario(FORMULARIO_VACIO);
    setEditandoId(null);
    setSimilares([]);
  }

  function iniciarEdicion(persona: Persona) {
    setEditandoId(persona.id);
    setSimilares([]);
    setError(null);
    setMensaje(null);
    setFormulario({
      nombres: persona.nombres,
      apellidos: persona.apellidos,
      documento: persona.documento ?? '',
      telefono: persona.telefono ?? '',
      email: persona.email ?? '',
      direccion: persona.direccion ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function guardar(
    evento: FormEvent | null,
    resolucion?: 'crear' | 'reutilizar',
  ) {
    evento?.preventDefault();
    setError(null);
    setMensaje(null);
    setGuardando(true);
    try {
      if (editandoId) {
        const actualizada = await editarPersona(db, editandoId, formulario);
        setMensaje(
          `Datos actualizados: ${nombreCompleto(actualizada.nombres, actualizada.apellidos)}.`,
        );
        limpiarFormulario();
        return;
      }

      const resultado = await registrarPersona(
        db,
        formulario,
        resolucion ? { resolucionSimilar: resolucion } : {},
      );
      if (resultado.estado === 'REQUIERE_DECISION') {
        setSimilares(resultado.similares);
        return;
      }
      setSimilares([]);
      setFormulario(FORMULARIO_VACIO);
      setMensaje(
        resultado.estado === 'REUTILIZADA'
          ? `Se usó la persona existente: ${nombreCompleto(resultado.persona!.nombres, resultado.persona!.apellidos)}.`
          : `Persona registrada: ${nombreCompleto(resultado.persona!.nombres, resultado.persona!.apellidos)}.`,
      );
    } catch (fallo) {
      setError(
        fallo instanceof ErrorDocumentoDuplicado
          ? fallo.message
          : mensajeDeError(fallo),
      );
    } finally {
      setGuardando(false);
    }
  }

  async function alternarEstado(persona: Persona) {
    setError(null);
    try {
      if (persona.activo) {
        await desactivarPersona(db, persona.id);
        setMensaje('Persona desactivada. Sus movimientos se conservan.');
      } else {
        await reactivarPersona(db, persona.id);
        setMensaje('Persona reactivada.');
      }
      if (ficha?.persona.id === persona.id) {
        setFicha(await consultarFichaPersona(db, persona.id));
      }
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  async function borrar(persona: Persona) {
    setError(null);
    if (
      !window.confirm(
        `¿Eliminar a ${nombreCompleto(persona.nombres, persona.apellidos)}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    try {
      await eliminarPersona(db, persona.id);
      if (ficha?.persona.id === persona.id) setFicha(null);
      setMensaje('Persona eliminada.');
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  async function abrirFicha(persona: Persona) {
    setError(null);
    try {
      setFicha(await consultarFichaPersona(db, persona.id));
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  return (
    <section className="pagina">
      <div className="pagina-encabezado">
        <div>
          <h1>Personas</h1>
          <p>
            Registra a quienes pagan suscripciones o reciben préstamos. La
            búsqueda no exige tildes ni mayúsculas y los duplicados se
            advierten antes de guardar.
          </p>
        </div>
      </div>

      <article className="tarjeta">
        <h2>{editandoId ? 'Editar persona' : 'Nueva persona'}</h2>
        <form className="formulario" onSubmit={(e) => guardar(e)}>
          <Campo etiqueta="Nombres *">
            <input
              value={formulario.nombres}
              onChange={(e) => cambiar('nombres', e.target.value)}
              autoComplete="given-name"
            />
          </Campo>
          <Campo etiqueta="Apellidos *">
            <input
              value={formulario.apellidos}
              onChange={(e) => cambiar('apellidos', e.target.value)}
              autoComplete="family-name"
            />
          </Campo>
          <Campo etiqueta="Documento" ayuda="DNI, carné o RUC. Único si se informa.">
            <input
              value={formulario.documento}
              onChange={(e) => cambiar('documento', e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input
              value={formulario.telefono}
              onChange={(e) => cambiar('telefono', e.target.value)}
              inputMode="tel"
            />
          </Campo>
          <Campo etiqueta="Correo">
            <input
              type="email"
              value={formulario.email}
              onChange={(e) => cambiar('email', e.target.value)}
            />
          </Campo>
          <Campo etiqueta="Dirección">
            <input
              value={formulario.direccion}
              onChange={(e) => cambiar('direccion', e.target.value)}
            />
          </Campo>

          <div className="ancho-completo acciones">
            <button
              className="boton boton-primario"
              type="submit"
              disabled={guardando}
            >
              {guardando
                ? 'Guardando…'
                : editandoId
                  ? 'Guardar cambios'
                  : 'Registrar persona'}
            </button>
            {editandoId ? (
              <button
                className="boton boton-secundario"
                type="button"
                onClick={limpiarFormulario}
              >
                Cancelar edición
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="ancho-completo">
              <Aviso tipo="error">
                <span>{error}</span>
              </Aviso>
            </div>
          ) : null}
          {mensaje ? (
            <div className="ancho-completo">
              <Aviso tipo="exito">
                <span>{mensaje}</span>
              </Aviso>
            </div>
          ) : null}
        </form>

        {similares.length > 0 ? (
          <div style={{ marginTop: '0.9rem' }}>
            <Aviso tipo="alerta">
              <div>
                <strong>Hay personas con datos similares:</strong>
                <ul style={{ margin: '0.35rem 0 0.6rem', paddingLeft: '1.1rem' }}>
                  {similares.map((persona) => (
                    <li key={persona.id}>
                      {nombreCompleto(persona.nombres, persona.apellidos)}
                      {persona.documento ? ` · ${persona.documento}` : ''}
                    </li>
                  ))}
                </ul>
                <div className="acciones">
                  <button
                    className="boton boton-primario boton-pequeno"
                    type="button"
                    onClick={() => guardar(null, 'reutilizar')}
                  >
                    Usar existente
                  </button>
                  <button
                    className="boton boton-secundario boton-pequeno"
                    type="button"
                    onClick={() => guardar(null, 'crear')}
                  >
                    Crear de todos modos
                  </button>
                  <button
                    className="boton boton-secundario boton-pequeno"
                    type="button"
                    onClick={() => setSimilares([])}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </Aviso>
          </div>
        ) : null}
      </article>

      {ficha ? (
        <article className="tarjeta">
          <div className="encabezado-tarjeta">
            <h2>
              Ficha de {nombreCompleto(ficha.persona.nombres, ficha.persona.apellidos)}
            </h2>
            <button
              className="boton boton-secundario boton-pequeno"
              type="button"
              onClick={() => setFicha(null)}
            >
              Cerrar ficha
            </button>
          </div>

          <dl className="detalle-lista">
            <div>
              <dt>Documento</dt>
              <dd>{ficha.persona.documento ?? '—'}</dd>
            </div>
            <div>
              <dt>Teléfono</dt>
              <dd>{ficha.persona.telefono ?? '—'}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{ficha.persona.email ?? '—'}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{ficha.persona.activo ? 'ACTIVA' : 'INACTIVA'}</dd>
            </div>
            {ficha.deudaPorMoneda.length === 0 ? (
              <div>
                <dt>Deuda total</dt>
                <dd>Sin deuda</dd>
              </div>
            ) : (
              ficha.deudaPorMoneda.map((deuda) => (
                <div key={deuda.moneda}>
                  <dt>Deuda en {deuda.moneda}</dt>
                  <dd>{formatearMoneda(deuda.centimos, deuda.moneda)}</dd>
                </div>
              ))
            )}
          </dl>

          <hr className="separador" />

          <h3>Suscripciones</h3>
          {ficha.suscripciones.length === 0 ? (
            <Vacio>Sin suscripciones.</Vacio>
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Suscripción</th>
                    <th>Estado</th>
                    <th className="numero">Monto acordado</th>
                    <th className="numero">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.suscripciones.map(({ miembro, suscripcion, saldoCentimos }) => (
                    <tr key={miembro.id}>
                      <td>{suscripcion.nombre}</td>
                      <td>
                        <Etiqueta color={miembro.estado === 'ACTIVO' ? 'verde' : 'gris'}>
                          {miembro.estado}
                        </Etiqueta>
                      </td>
                      <td className="numero">
                        {formatearMoneda(miembro.montoAcordadoCentimos, suscripcion.moneda)}
                      </td>
                      <td className="numero">
                        {formatearMoneda(saldoCentimos, suscripcion.moneda)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <hr className="separador" />

          <h3>Préstamos</h3>
          {ficha.prestamos.length === 0 ? (
            <Vacio>Sin préstamos.</Vacio>
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Capital</th>
                    <th>Plazo</th>
                    <th>Tasa mensual</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.prestamos.map((prestamo) => (
                    <tr key={prestamo.id}>
                      <td className="numero">
                        {formatearMoneda(prestamo.capitalCentimos, prestamo.moneda)}
                      </td>
                      <td>{prestamo.plazoMeses} meses</td>
                      <td className="numero">{prestamo.tasaMensual}%</td>
                      <td>
                        <Etiqueta color={prestamo.estado === 'ACTIVO' ? 'azul' : 'gris'}>
                          {prestamo.estado}
                        </Etiqueta>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <hr className="separador" />

          <h3>Pagos recientes</h3>
          {ficha.pagosRecientes.length === 0 ? (
            <Vacio>Sin pagos registrados.</Vacio>
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th className="numero">Monto</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.pagosRecientes.map((pago) => (
                    <tr key={pago.id}>
                      <td>{formatearFecha(pago.fechaPago)}</td>
                      <td>{pago.metodoPago}</td>
                      <td className="numero">
                        {formatearMoneda(pago.montoCentimos, pago.moneda)}
                      </td>
                      <td>
                        <Etiqueta color={pago.estado === 'REGISTRADO' ? 'verde' : 'roja'}>
                          {pago.estado}
                        </Etiqueta>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ) : null}

      <article className="tarjeta">
        <div className="encabezado-tarjeta">
          <h2>Personas registradas</h2>
          <span className="nota">
            {lista?.total ?? 0} resultado(s)
          </span>
        </div>

        <div className="fila-filtros">
          <Campo etiqueta="Buscar">
            <input
              placeholder="Nombre, apellido o documento"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
            />
          </Campo>
          <Campo etiqueta="Estado">
            <select
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value as FiltroEstadoPersona);
                setPagina(1);
              }}
            >
              <option value="TODAS">Todas</option>
              <option value="ACTIVAS">Activas</option>
              <option value="INACTIVAS">Inactivas</option>
            </select>
          </Campo>
        </div>

        {lista === undefined ? (
          <Cargando />
        ) : lista.items.length === 0 ? (
          <Vacio>No hay personas que coincidan con el filtro.</Vacio>
        ) : (
          <>
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Documento</th>
                    <th>Contacto</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.items.map((persona) => (
                    <tr key={persona.id}>
                      <td>
                        <strong>
                          {nombreCompleto(persona.apellidos, persona.nombres)}
                        </strong>
                      </td>
                      <td>{persona.documento ?? '—'}</td>
                      <td>{persona.telefono ?? persona.email ?? '—'}</td>
                      <td>
                        <Etiqueta color={persona.activo ? 'verde' : 'roja'}>
                          {persona.activo ? 'ACTIVA' : 'INACTIVA'}
                        </Etiqueta>
                      </td>
                      <td>
                        <div className="grilla-inline">
                          <button
                            className="boton boton-secundario boton-pequeno"
                            type="button"
                            onClick={() => abrirFicha(persona)}
                          >
                            Ficha
                          </button>
                          <button
                            className="boton boton-secundario boton-pequeno"
                            type="button"
                            onClick={() => iniciarEdicion(persona)}
                          >
                            Editar
                          </button>
                          <button
                            className="boton boton-secundario boton-pequeno"
                            type="button"
                            onClick={() => alternarEstado(persona)}
                          >
                            {persona.activo ? 'Desactivar' : 'Reactivar'}
                          </button>
                          <button
                            className="boton boton-peligro boton-pequeno"
                            type="button"
                            onClick={() => borrar(persona)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="acciones" style={{ marginTop: '0.8rem' }}>
              <button
                className="boton boton-secundario boton-pequeno"
                type="button"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span className="nota">
                Página {lista.pagina} de {lista.paginas}
              </span>
              <button
                className="boton boton-secundario boton-pequeno"
                type="button"
                disabled={pagina >= lista.paginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </>
        )}
      </article>
    </section>
  );
}
