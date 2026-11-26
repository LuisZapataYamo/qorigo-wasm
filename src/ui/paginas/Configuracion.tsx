import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../infraestructura/persistencia/baseDatos';
import {
  cambiarPassword,
  cerrarSesion,
  configurarAcceso,
  crearAccesoPersona,
  listarUsuarios,
  sesionActual,
} from '../../aplicacion/sesion';
import {
  activarRecordatorios,
  calcularRecordatorios,
  desactivarRecordatorios,
  ejecutarRecordatorios,
  guardarDiasRecordatorio,
  recordatorioDePrueba,
  type EstadoPermiso,
} from '../../aplicacion/notificaciones';
import {
  notificacionesSoportadas,
  notificadorNavegador,
  permisoNotificaciones,
} from '../../infraestructura/notificaciones/navegador';
import { mensajeDeError } from '../../dominio/errores';
import { formatearFecha } from '../../dominio/fechas';
import { nombreCompleto } from '../../dominio/nombres';
import { Aviso, Campo, Cargando, Etiqueta, Vacio } from '../componentes';

export function Configuracion() {
  const [alta, setAlta] = useState({
    personaId: '',
    email: '',
    password: '',
  });
  const [miembro, setMiembro] = useState({
    personaId: '',
    email: '',
    password: '',
  });
  const [cambio, setCambio] = useState({ actual: '', nueva: '' });
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [permiso, setPermiso] = useState<EstadoPermiso>(() =>
    permisoNotificaciones(),
  );
  const [diasRecordatorio, setDiasRecordatorio] = useState(3);
  const [mensajeNotif, setMensajeNotif] = useState<string | null>(null);
  const [errorNotif, setErrorNotif] = useState<string | null>(null);

  const configurado = useLiveQuery(
    () => db.configuracion.get('acceso_configurado'),
    [],
  );
  const sesion = useLiveQuery(() => sesionActual(db), []);
  const usuarios = useLiveQuery(() => listarUsuarios(db), []);
  const notificacionesActivas = useLiveQuery(
    async () =>
      (await db.configuracion.get('notificaciones_activas'))?.valor === 'SI',
    [],
  );
  const diasConfig = useLiveQuery(
    async () =>
      Number(
        (await db.configuracion.get('recordatorios_dias'))?.valor ?? '3',
      ),
    [],
  );
  const pendientes = useLiveQuery(async () => {
    const lista = await calcularRecordatorios(db, {
      diasAviso: diasRecordatorio,
    });
    const enviados = new Set(
      (await db.recordatorios.toArray()).map((registro) => registro.clave),
    );
    return lista.filter((recordatorio) => !enviados.has(recordatorio.clave));
  }, [diasRecordatorio]);

  useEffect(() => {
    if (diasConfig !== undefined && Number.isFinite(diasConfig)) {
      setDiasRecordatorio(diasConfig);
    }
  }, [diasConfig]);

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

  const tieneAcceso = configurado?.valor === 'SI';

  async function guardarAlta(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setMensaje(null);
    try {
      await configurarAcceso(db, alta);
      setMensaje('Acceso local creado. La aplicación quedó desbloqueada.');
      setAlta({ personaId: '', email: '', password: '' });
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  async function guardarMiembro(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setMensaje(null);
    try {
      const usuario = await crearAccesoPersona(db, {
        ...miembro,
        rol: 'MEMBER',
      });
      setMensaje(`Acceso de miembro creado: ${usuario.email}.`);
      setMiembro({ personaId: '', email: '', password: '' });
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  async function guardarCambio(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setMensaje(null);
    if (!sesion) return;
    try {
      await cambiarPassword(db, sesion.id, cambio.actual, cambio.nueva);
      setMensaje('Contraseña actualizada.');
      setCambio({ actual: '', nueva: '' });
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  async function salir() {
    await cerrarSesion(db);
  }

  async function activarNotificaciones() {
    setErrorNotif(null);
    setMensajeNotif(null);
    try {
      const estado = await activarRecordatorios(
        db,
        notificadorNavegador,
        diasRecordatorio,
      );
      setPermiso(estado);
      if (estado === 'granted') {
        const resultado = await ejecutarRecordatorios(db, {
          notificador: notificadorNavegador,
        });
        setMensajeNotif(
          resultado.enviados > 0
            ? `Recordatorios activados. Se enviaron ${resultado.enviados} aviso(s).`
            : 'Recordatorios activados. No había avisos pendientes.',
        );
      } else if (estado === 'denied') {
        setErrorNotif(
          'El navegador bloqueó las notificaciones. Habilítalas desde la configuración del sitio.',
        );
      } else if (estado === 'no_soportado') {
        setErrorNotif('Este navegador no admite notificaciones.');
      } else {
        setErrorNotif('No se concedió el permiso de notificaciones.');
      }
    } catch (fallo) {
      setErrorNotif(mensajeDeError(fallo));
    }
  }

  async function desactivarNotificaciones() {
    setErrorNotif(null);
    setMensajeNotif(null);
    try {
      await desactivarRecordatorios(db);
      setMensajeNotif('Recordatorios desactivados.');
    } catch (fallo) {
      setErrorNotif(mensajeDeError(fallo));
    }
  }

  async function guardarDias() {
    setErrorNotif(null);
    setMensajeNotif(null);
    try {
      await guardarDiasRecordatorio(db, diasRecordatorio);
      setMensajeNotif('Días de anticipación guardados.');
    } catch (fallo) {
      setErrorNotif(mensajeDeError(fallo));
    }
  }

  async function probarNotificacion() {
    setErrorNotif(null);
    setMensajeNotif(null);
    try {
      if (permiso !== 'granted') {
        setErrorNotif('Primero activa los recordatorios y concede el permiso.');
        return;
      }
      const prueba = recordatorioDePrueba();
      await notificadorNavegador.mostrar({
        clave: prueba.clave,
        titulo: prueba.titulo,
        cuerpo: prueba.cuerpo,
      });
      setMensajeNotif('Notificación de prueba enviada.');
    } catch (fallo) {
      setErrorNotif(mensajeDeError(fallo));
    }
  }

  const soportadas = notificacionesSoportadas();
  const recordatoriosActivos =
    notificacionesActivas === true && permiso === 'granted';
  const estadoNotificaciones = !soportadas
    ? 'NO SOPORTADO'
    : permiso === 'granted'
      ? recordatoriosActivos
        ? 'ACTIVOS'
        : 'PERMISO CONCEDIDO'
      : permiso === 'denied'
        ? 'BLOQUEADO'
        : 'SIN PERMISO';

  return (
    <section className="pagina">
      <div className="pagina-encabezado">
        <div>
          <h1>Configuración</h1>
          <p>
            Acceso local opcional. Sin servidor no existe autenticación remota:
            esta barrera evita el uso casual, pero no protege los datos frente
            a quien controle el dispositivo.
          </p>
        </div>
      </div>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {mensaje ? <Aviso tipo="exito">{mensaje}</Aviso> : null}

      <article className="tarjeta">
        <div className="encabezado-tarjeta">
          <h2>Recordatorios de pago</h2>
          <Etiqueta
            color={
              recordatoriosActivos
                ? 'verde'
                : permiso === 'denied' || !soportadas
                  ? 'roja'
                  : 'ambar'
            }
          >
            {estadoNotificaciones}
          </Etiqueta>
        </div>

        <p className="nota">
          Avisos de cobros de suscripción y de cuotas de préstamo. Se calculan
          en el dispositivo con IndexedDB: <strong>funcionan sin internet</strong>{' '}
          una vez instalada la aplicación.
        </p>

        {!soportadas ? (
          <Aviso tipo="error">
            Este navegador no admite notificaciones. En Android prueba con
            Chrome o Edge; en computadora, con un navegador actualizado.
          </Aviso>
        ) : null}

        {permiso === 'denied' ? (
          <Aviso tipo="alerta">
            Las notificaciones están bloqueadas para este sitio. Habilítalas
            desde el candado o la configuración del navegador y vuelve a
            intentar.
          </Aviso>
        ) : null}

        <div className="formulario" style={{ marginTop: '0.8rem' }}>
          <Campo
            etiqueta="Avisar con días de anticipación"
            ayuda="0 = solo el día de vencimiento."
          >
            <input
              type="number"
              min={0}
              max={30}
              value={diasRecordatorio}
              onChange={(e) =>
                setDiasRecordatorio(Number(e.target.value))
              }
            />
          </Campo>
          <div className="acciones">
            {recordatoriosActivos ? (
              <button
                className="boton boton-secundario"
                type="button"
                onClick={() => void desactivarNotificaciones()}
              >
                Desactivar recordatorios
              </button>
            ) : (
              <button
                className="boton boton-primario"
                type="button"
                onClick={() => void activarNotificaciones()}
                disabled={!soportadas}
              >
                Activar recordatorios
              </button>
            )}
            <button
              className="boton boton-secundario"
              type="button"
              onClick={() => void guardarDias()}
            >
              Guardar días
            </button>
            <button
              className="boton boton-secundario"
              type="button"
              onClick={() => void probarNotificacion()}
              disabled={permiso !== 'granted'}
            >
              Probar notificación
            </button>
          </div>
        </div>

        {errorNotif ? (
          <div style={{ marginTop: '0.7rem' }}>
            <Aviso tipo="error">{errorNotif}</Aviso>
          </div>
        ) : null}
        {mensajeNotif ? (
          <div style={{ marginTop: '0.7rem' }}>
            <Aviso tipo="exito">{mensajeNotif}</Aviso>
          </div>
        ) : null}

        <hr className="separador" />
        <h3>Próximos avisos</h3>
        {pendientes === undefined ? (
          <Cargando />
        ) : pendientes.length === 0 ? (
          <Vacio>
            No hay avisos pendientes con {diasRecordatorio} día(s) de
            anticipación.
          </Vacio>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Aviso</th>
                  <th>Vence</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.slice(0, 10).map((recordatorio) => (
                  <tr key={recordatorio.clave}>
                    <td>{recordatorio.titulo}</td>
                    <td>{formatearFecha(recordatorio.fechaVencimiento)}</td>
                    <td>
                      <Etiqueta
                        color={
                          recordatorio.momento === 'VENCIDO'
                            ? 'roja'
                            : recordatorio.momento === 'HOY'
                              ? 'ambar'
                              : 'azul'
                        }
                      >
                        {recordatorio.momento}
                      </Etiqueta>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '0.8rem' }}>
          <Aviso tipo="info">
            El navegador revisa los avisos cuando QoriGo está abierto o vuelve
            a estar activo. Si la aplicación está cerrada, <strong>no hay aviso
            garantizado</strong>: no existe un servidor push y los datos siguen
            siendo locales. Funciona igual en Android y en computadora, siempre
            que el permiso esté concedido.
          </Aviso>
        </div>
      </article>

      {!tieneAcceso ? (
        <article className="tarjeta">
          <h2>Crear acceso local</h2>
          <form className="formulario" onSubmit={guardarAlta}>
            <Campo etiqueta="Persona administradora *">
              <select
                value={alta.personaId}
                onChange={(e) =>
                  setAlta((a) => ({ ...a, personaId: e.target.value }))
                }
              >
                <option value="">Selecciona…</option>
                {(personas ?? []).map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {nombreCompleto(persona.apellidos, persona.nombres)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Correo *">
              <input
                type="email"
                value={alta.email}
                onChange={(e) =>
                  setAlta((a) => ({ ...a, email: e.target.value }))
                }
              />
            </Campo>
            <Campo etiqueta="Contraseña *" ayuda="Mínimo 8 caracteres.">
              <input
                type="password"
                value={alta.password}
                onChange={(e) =>
                  setAlta((a) => ({ ...a, password: e.target.value }))
                }
              />
            </Campo>
            <div className="acciones">
              <button className="boton boton-primario" type="submit">
                Crear acceso
              </button>
            </div>
          </form>
        </article>
      ) : (
        <>
          <article className="tarjeta">
            <div className="encabezado-tarjeta">
              <h2>Sesión actual</h2>
              <button
                className="boton boton-secundario boton-pequeno"
                type="button"
                onClick={() => void salir()}
              >
                Cerrar sesión
              </button>
            </div>
            {sesion ? (
              <dl className="detalle-lista">
                <div>
                  <dt>Correo</dt>
                  <dd>{sesion.email}</dd>
                </div>
                <div>
                  <dt>Rol local</dt>
                  <dd>{sesion.rol}</dd>
                </div>
                <div>
                  <dt>Persona</dt>
                  <dd>
                    {(() => {
                      const persona = (personas ?? []).find(
                        (p) => p.id === sesion.personaId,
                      );
                      return persona
                        ? nombreCompleto(persona.apellidos, persona.nombres)
                        : '—';
                    })()}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="nota">Sesión cerrada.</p>
            )}
          </article>

          <article className="tarjeta">
            <h2>Accesos de este dispositivo</h2>
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Persona</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(usuarios ?? []).map((usuario) => {
                    const persona = (personas ?? []).find(
                      (p) => p.id === usuario.personaId,
                    );
                    return (
                      <tr key={usuario.id}>
                        <td>{usuario.email}</td>
                        <td>
                          <Etiqueta
                            color={usuario.rol === 'ADMIN' ? 'azul' : 'gris'}
                          >
                            {usuario.rol}
                          </Etiqueta>
                        </td>
                        <td>
                          {persona
                            ? nombreCompleto(
                                persona.apellidos,
                                persona.nombres,
                              )
                            : '—'}
                        </td>
                        <td>
                          <Etiqueta color={usuario.activo ? 'verde' : 'roja'}>
                            {usuario.activo ? 'ACTIVO' : 'INACTIVO'}
                          </Etiqueta>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="nota" style={{ marginTop: '0.5rem' }}>
              Los roles son informativos en una aplicación sin servidor: no
              protegen los datos de quien controla el dispositivo.
            </p>
          </article>

          <article className="tarjeta">
            <h2>Crear acceso de miembro</h2>
            <form className="formulario" onSubmit={guardarMiembro}>
              <Campo etiqueta="Persona">
                <select
                  value={miembro.personaId}
                  onChange={(e) =>
                    setMiembro((a) => ({
                      ...a,
                      personaId: e.target.value,
                    }))
                  }
                >
                  <option value="">Selecciona…</option>
                  {(personas ?? []).map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {nombreCompleto(persona.apellidos, persona.nombres)}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Correo">
                <input
                  type="email"
                  value={miembro.email}
                  onChange={(e) =>
                    setMiembro((a) => ({ ...a, email: e.target.value }))
                  }
                />
              </Campo>
              <Campo etiqueta="Contraseña">
                <input
                  type="password"
                  value={miembro.password}
                  onChange={(e) =>
                    setMiembro((a) => ({ ...a, password: e.target.value }))
                  }
                />
              </Campo>
              <div className="acciones">
                <button className="boton boton-primario" type="submit">
                  Crear acceso
                </button>
              </div>
            </form>
          </article>

          <article className="tarjeta">
            <h2>Cambiar contraseña</h2>
            <form className="formulario" onSubmit={guardarCambio}>
              <Campo etiqueta="Contraseña actual">
                <input
                  type="password"
                  value={cambio.actual}
                  onChange={(e) =>
                    setCambio((a) => ({ ...a, actual: e.target.value }))
                  }
                />
              </Campo>
              <Campo etiqueta="Contraseña nueva">
                <input
                  type="password"
                  value={cambio.nueva}
                  onChange={(e) =>
                    setCambio((a) => ({ ...a, nueva: e.target.value }))
                  }
                />
              </Campo>
              <div className="acciones">
                <button className="boton boton-primario" type="submit">
                  Guardar
                </button>
              </div>
            </form>
            <p className="nota" style={{ marginTop: '0.5rem' }}>
              No hay recuperación por correo: sin servidor no se pueden enviar
              enlaces. Si olvidas la contraseña, restaura un respaldo o
              reinstala el acceso en este dispositivo.
            </p>
          </article>
        </>
      )}
    </section>
  );
}
