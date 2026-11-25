import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/baseDatos';
import {
  ErrorDocumentoDuplicado,
  registrarPersona,
  type EntradaPersona,
} from '../../aplicacion/personas';
import { mensajeDeError } from '../../dominio/errores';
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

export function Personas() {
  const [formulario, setFormulario] = useState<EntradaPersona>(FORMULARIO_VACIO);
  const [similares, setSimilares] = useState<Persona[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const personas = useLiveQuery(
    () => db.personas.toArray().then((lista) =>
      lista.sort((a, b) =>
        nombreCompleto(a.apellidos, a.nombres).localeCompare(
          nombreCompleto(b.apellidos, b.nombres),
          'es',
        ),
      ),
    ),
    [],
    [],
  );

  function cambiar(campo: keyof EntradaPersona, valor: string) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
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
      if (fallo instanceof ErrorDocumentoDuplicado) {
        setError(fallo.message);
      } else {
        setError(mensajeDeError(fallo));
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="pagina">
      <div className="pagina-encabezado">
        <div>
          <h1>Personas</h1>
          <p>
            Registra a quienes pagan suscripciones o reciben préstamos. La
            búsqueda de duplicados compara nombres sin tildes ni mayúsculas.
          </p>
        </div>
      </div>

      <article className="tarjeta">
        <h2>Nueva persona</h2>
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
              {guardando ? 'Guardando…' : 'Registrar persona'}
            </button>
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

      <article className="tarjeta">
        <div className="encabezado-tarjeta">
          <h2>Personas registradas</h2>
          <span className="nota">{personas?.length ?? 0} en total</span>
        </div>

        {personas === undefined ? (
          <Cargando />
        ) : personas.length === 0 ? (
          <Vacio>Aún no hay personas registradas.</Vacio>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Documento</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((persona) => (
                  <tr key={persona.id}>
                    <td>
                      <strong>
                        {nombreCompleto(persona.apellidos, persona.nombres)}
                      </strong>
                    </td>
                    <td>{persona.documento ?? '—'}</td>
                    <td>
                      {persona.telefono ?? persona.email ?? '—'}
                    </td>
                    <td>
                      <Etiqueta color={persona.activo ? 'verde' : 'roja'}>
                        {persona.activo ? 'ACTIVA' : 'INACTIVA'}
                      </Etiqueta>
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
