import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/baseDatos';
import {
  cambiarPassword,
  cerrarSesion,
  configurarAcceso,
  crearAccesoPersona,
  listarUsuarios,
  sesionActual,
} from '../../aplicacion/sesion';
import { mensajeDeError } from '../../dominio/errores';
import { nombreCompleto } from '../../dominio/nombres';
import { Aviso, Campo, Etiqueta } from '../componentes';

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

  const configurado = useLiveQuery(
    () => db.configuracion.get('acceso_configurado'),
    [],
  );
  const sesion = useLiveQuery(() => sesionActual(db), []);
  const usuarios = useLiveQuery(() => listarUsuarios(db), []);
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
