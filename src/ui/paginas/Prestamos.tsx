import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/baseDatos';
import {
  ajustarCuota,
  cambiarCumplimiento,
  crearPrestamo,
  crearPrestamoConPersonaNueva,
  cuotasDePrestamo,
  listarPrestamos,
  simularPrestamo,
  type PrestamoListado,
  type SimulacionPrestamo,
} from '../../aplicacion/prestamos';
import { formatearMoneda } from '../../dominio/dinero';
import { formatearFecha, hoy, sumarMeses } from '../../dominio/fechas';
import { mensajeDeError } from '../../dominio/errores';
import { nombreCompleto } from '../../dominio/nombres';
import type { CuotaPrestamo, Persona } from '../../db/tipos';
import { Aviso, Campo, Etiqueta, Vacio } from '../componentes';

export function Prestamos() {
  const [formulario, setFormulario] = useState({
    capital: '2000.00',
    tasaMensual: '5',
    plazoMeses: '6',
    fechaPrimerPago: sumarMeses(hoy(), 1),
  });
  const [simulacion, setSimulacion] = useState<SimulacionPrestamo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [alta, setAlta] = useState({
    modo: 'EXISTENTE',
    personaId: '',
    nombres: '',
    apellidos: '',
    moneda: 'PEN',
    capital: '2000.00',
    tasaMensual: '5',
    plazoMeses: '6',
    fechaPrestamo: hoy(),
    estricto: 'NO',
    notas: '',
  });
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  const [mensajeAlta, setMensajeAlta] = useState<string | null>(null);
  const [similaresAlta, setSimilaresAlta] = useState<Persona[]>([]);
  const [seleccion, setSeleccion] = useState<{
    prestamo: PrestamoListado;
    cuotas: CuotaPrestamo[];
  } | null>(null);
  const [ajuste, setAjuste] = useState<{
    cuotaId: string;
    numero: number;
    monto: string;
    motivo: string;
    redistribucion: 'EQUITATIVA' | 'ULTIMA';
  } | null>(null);
  const [errorAjuste, setErrorAjuste] = useState<string | null>(null);
  const [mensajeAjuste, setMensajeAjuste] = useState<string | null>(null);

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
  const prestamos = useLiveQuery(() => listarPrestamos(db), [], []);

  function simular(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    try {
      setSimulacion(
        simularPrestamo({
          capital: formulario.capital,
          tasaMensual: Number(formulario.tasaMensual),
          plazoMeses: Number(formulario.plazoMeses),
          fechaPrimerPago: formulario.fechaPrimerPago,
        }),
      );
    } catch (fallo) {
      setSimulacion(null);
      setError(mensajeDeError(fallo));
    }
  }

  async function crear(resolucion?: 'crear' | 'reutilizar') {
    setErrorAlta(null);
    setMensajeAlta(null);
    try {
      const datos = {
        moneda: alta.moneda,
        capital: alta.capital,
        tasaMensual: Number(alta.tasaMensual),
        plazoMeses: Number(alta.plazoMeses),
        fechaPrestamo: alta.fechaPrestamo,
        estrictoCumplimiento: alta.estricto === 'SI',
        notas: alta.notas,
      };
      let creado;
      if (alta.modo === 'NUEVO') {
        const resultado = await crearPrestamoConPersonaNueva(
          db,
          { nombres: alta.nombres, apellidos: alta.apellidos },
          datos,
          resolucion,
        );
        if (resultado.estado === 'PERSONA_REQUIERE_DECISION') {
          setSimilaresAlta(resultado.similares);
          return;
        }
        creado = resultado.creado!;
      } else {
        if (!alta.personaId) {
          setErrorAlta('Selecciona una persona.');
          return;
        }
        creado = await crearPrestamo(db, {
          ...datos,
          personaId: alta.personaId,
        });
      }
      setSimilaresAlta([]);
      setMensajeAlta(
        `Préstamo creado con ${creado.cuotas.length} cuotas.`,
      );
      setAlta((actual) => ({
        ...actual,
        personaId: '',
        nombres: '',
        apellidos: '',
        notas: '',
      }));
      const listado = (await listarPrestamos(db)).find(
        (p) => p.id === creado!.prestamo.id,
      );
      if (listado) {
        setSeleccion({
          prestamo: listado,
          cuotas: await cuotasDePrestamo(db, listado.id),
        });
      }
    } catch (fallo) {
      setErrorAlta(mensajeDeError(fallo));
    }
  }

  async function verCronograma(prestamo: PrestamoListado) {
    setSeleccion({
      prestamo,
      cuotas: await cuotasDePrestamo(db, prestamo.id),
    });
  }

  async function guardarAjuste() {
    if (!ajuste || !seleccion) return;
    setErrorAjuste(null);
    setMensajeAjuste(null);
    try {
      await ajustarCuota(db, ajuste.cuotaId, {
        nuevoMonto: ajuste.monto,
        motivo: ajuste.motivo,
        redistribucion: ajuste.redistribucion,
      });
      setMensajeAjuste('Cuota ajustada y total del préstamo conservado.');
      setAjuste(null);
      setSeleccion({
        ...seleccion,
        cuotas: await cuotasDePrestamo(db, seleccion.prestamo.id),
      });
    } catch (fallo) {
      setErrorAjuste(mensajeDeError(fallo));
    }
  }

  async function alternarTipo() {
    if (!seleccion) return;
    setErrorAjuste(null);
    try {
      const actualizado = await cambiarCumplimiento(
        db,
        seleccion.prestamo.id,
        !seleccion.prestamo.estrictoCumplimiento,
      );
      setSeleccion({
        ...seleccion,
        prestamo: { ...seleccion.prestamo, ...actualizado },
      });
      setMensajeAjuste(
        `Ahora el préstamo es ${actualizado.estrictoCumplimiento ? 'estricto' : 'flexible'}.`,
      );
    } catch (fallo) {
      setErrorAjuste(mensajeDeError(fallo));
    }
  }

  return (
    <section className="pagina">
      <div className="pagina-encabezado">
        <div>
          <h1>Préstamos</h1>
          <p>
            Interés simple mensual sobre el capital original. La simulación no
            guarda nada: puedes repetirla hasta confirmar las condiciones.
          </p>
        </div>
      </div>

      <article className="tarjeta">
        <h2>Simulador de préstamo</h2>
        <form className="formulario" onSubmit={simular}>
          <Campo etiqueta="Capital *">
            <input
              inputMode="decimal"
              value={formulario.capital}
              onChange={(e) =>
                setFormulario((a) => ({ ...a, capital: e.target.value }))
              }
            />
          </Campo>
          <Campo etiqueta="Tasa mensual (%) *">
            <input
              inputMode="decimal"
              value={formulario.tasaMensual}
              onChange={(e) =>
                setFormulario((a) => ({ ...a, tasaMensual: e.target.value }))
              }
            />
          </Campo>
          <Campo etiqueta="Plazo (meses) *">
            <input
              type="number"
              min={1}
              max={120}
              value={formulario.plazoMeses}
              onChange={(e) =>
                setFormulario((a) => ({ ...a, plazoMeses: e.target.value }))
              }
            />
          </Campo>
          <Campo etiqueta="Primer pago *">
            <input
              type="date"
              value={formulario.fechaPrimerPago}
              onChange={(e) =>
                setFormulario((a) => ({
                  ...a,
                  fechaPrimerPago: e.target.value,
                }))
              }
            />
          </Campo>
          <div className="acciones">
            <button className="boton boton-primario" type="submit">
              Simular
            </button>
          </div>
        </form>
        {error ? (
          <div style={{ marginTop: '0.8rem' }}>
            <Aviso tipo="error">{error}</Aviso>
          </div>
        ) : null}
      </article>

      <article className="tarjeta">
        <h2>Registrar préstamo</h2>
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault();
            void crear();
          }}
        >
          <Campo etiqueta="Titular">
            <select
              value={alta.modo}
              onChange={(e) =>
                setAlta((a) => ({ ...a, modo: e.target.value }))
              }
            >
              <option value="EXISTENTE">Persona existente</option>
              <option value="NUEVO">Persona nueva</option>
            </select>
          </Campo>
          {alta.modo === 'EXISTENTE' ? (
            <Campo etiqueta="Persona">
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
          ) : (
            <>
              <Campo etiqueta="Nombres">
                <input
                  value={alta.nombres}
                  onChange={(e) =>
                    setAlta((a) => ({ ...a, nombres: e.target.value }))
                  }
                />
              </Campo>
              <Campo etiqueta="Apellidos">
                <input
                  value={alta.apellidos}
                  onChange={(e) =>
                    setAlta((a) => ({ ...a, apellidos: e.target.value }))
                  }
                />
              </Campo>
            </>
          )}
          <Campo etiqueta="Moneda">
            <select
              value={alta.moneda}
              onChange={(e) =>
                setAlta((a) => ({ ...a, moneda: e.target.value }))
              }
            >
              {(monedas ?? []).map((moneda) => (
                <option key={moneda.codigo} value={moneda.codigo}>
                  {moneda.codigo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Capital *">
            <input
              inputMode="decimal"
              value={alta.capital}
              onChange={(e) =>
                setAlta((a) => ({ ...a, capital: e.target.value }))
              }
            />
          </Campo>
          <Campo etiqueta="Tasa mensual (%) *">
            <input
              inputMode="decimal"
              value={alta.tasaMensual}
              onChange={(e) =>
                setAlta((a) => ({ ...a, tasaMensual: e.target.value }))
              }
            />
          </Campo>
          <Campo etiqueta="Plazo (meses) *">
            <input
              type="number"
              min={1}
              max={120}
              value={alta.plazoMeses}
              onChange={(e) =>
                setAlta((a) => ({ ...a, plazoMeses: e.target.value }))
              }
            />
          </Campo>
          <Campo etiqueta="Fecha del préstamo *">
            <input
              type="date"
              value={alta.fechaPrestamo}
              onChange={(e) =>
                setAlta((a) => ({ ...a, fechaPrestamo: e.target.value }))
              }
            />
          </Campo>
          <Campo
            etiqueta="Estricto cumplimiento"
            ayuda="Estricto suma lo vencido al exigible del mes."
          >
            <select
              value={alta.estricto}
              onChange={(e) =>
                setAlta((a) => ({ ...a, estricto: e.target.value }))
              }
            >
              <option value="NO">Flexible</option>
              <option value="SI">Estricto</option>
            </select>
          </Campo>
          <Campo etiqueta="Notas">
            <input
              value={alta.notas}
              onChange={(e) =>
                setAlta((a) => ({ ...a, notas: e.target.value }))
              }
            />
          </Campo>
          <div className="ancho-completo acciones">
            <button className="boton boton-primario" type="submit">
              Crear préstamo
            </button>
          </div>
          {errorAlta ? (
            <div className="ancho-completo">
              <Aviso tipo="error">{errorAlta}</Aviso>
            </div>
          ) : null}
          {mensajeAlta ? (
            <div className="ancho-completo">
              <Aviso tipo="exito">{mensajeAlta}</Aviso>
            </div>
          ) : null}
        </form>

        {similaresAlta.length > 0 ? (
          <div style={{ marginTop: '0.8rem' }}>
            <Aviso tipo="alerta">
              <div>
                <strong>Hay personas similares:</strong>
                <ul style={{ margin: '0.3rem 0 0.5rem', paddingLeft: '1.1rem' }}>
                  {similaresAlta.map((persona) => (
                    <li key={persona.id}>
                      {nombreCompleto(persona.apellidos, persona.nombres)}
                    </li>
                  ))}
                </ul>
                <div className="acciones">
                  <button
                    className="boton boton-primario boton-pequeno"
                    type="button"
                    onClick={() => void crear('reutilizar')}
                  >
                    Usar existente
                  </button>
                  <button
                    className="boton boton-secundario boton-pequeno"
                    type="button"
                    onClick={() => void crear('crear')}
                  >
                    Crear de todos modos
                  </button>
                </div>
              </div>
            </Aviso>
          </div>
        ) : null}
      </article>

      {simulacion ? (
        <article className="tarjeta">
          <div className="encabezado-tarjeta">
            <h2>Cronograma simulado</h2>
            <span className="nota">No guardado</span>
          </div>
          <dl className="detalle-lista">
            <div>
              <dt>Capital</dt>
              <dd>{formatearMoneda(simulacion.capitalCentimos, 'PEN')}</dd>
            </div>
            <div>
              <dt>Interés total</dt>
              <dd>{formatearMoneda(simulacion.interesTotalCentimos, 'PEN')}</dd>
            </div>
            <div>
              <dt>Total a cobrar</dt>
              <dd>{formatearMoneda(simulacion.totalCentimos, 'PEN')}</dd>
            </div>
            <div>
              <dt>Cuotas</dt>
              <dd>{simulacion.cuotas.length}</dd>
            </div>
          </dl>
          <div className="tabla-contenedor" style={{ marginTop: '0.8rem' }}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Vencimiento</th>
                  <th className="numero">Capital</th>
                  <th className="numero">Interés</th>
                  <th className="numero">Cuota</th>
                </tr>
              </thead>
              <tbody>
                {simulacion.cuotas.map((cuota) => (
                  <tr key={cuota.numero}>
                    <td>{cuota.numero}</td>
                    <td>{formatearFecha(cuota.fechaVencimiento)}</td>
                    <td className="numero">
                      {formatearMoneda(cuota.capitalCentimos, 'PEN')}
                    </td>
                    <td className="numero">
                      {formatearMoneda(cuota.interesCentimos, 'PEN')}
                    </td>
                    <td className="numero">
                      {formatearMoneda(cuota.montoCentimos, 'PEN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="nota" style={{ marginTop: '0.6rem' }}>
            La última cuota absorbe el redondeo para que la suma sea exacta.
          </p>
        </article>
      ) : null}

      <article className="tarjeta">
        <div className="encabezado-tarjeta">
          <h2>Préstamos registrados</h2>
          <span className="nota">{prestamos?.length ?? 0} en total</span>
        </div>
        {prestamos === undefined ? (
          <p className="cargando">Cargando…</p>
        ) : prestamos.length === 0 ? (
          <Vacio>Aún no hay préstamos registrados.</Vacio>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Titular</th>
                  <th>Fecha</th>
                  <th className="numero">Capital</th>
                  <th>Plazo</th>
                  <th>Tasa</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {prestamos.map((prestamo) => (
                  <tr key={prestamo.id}>
                    <td>{prestamo.persona}</td>
                    <td>{formatearFecha(prestamo.fechaPrestamo)}</td>
                    <td className="numero">
                      {formatearMoneda(
                        prestamo.capitalCentimos,
                        prestamo.moneda,
                      )}
                    </td>
                    <td>{prestamo.plazoMeses} m</td>
                    <td>{prestamo.tasaMensual}%</td>
                    <td>
                      {prestamo.estrictoCumplimiento ? 'Estricto' : 'Flexible'}
                    </td>
                    <td>
                      <Etiqueta
                        color={
                          prestamo.estado === 'ACTIVO'
                            ? 'azul'
                            : prestamo.estado === 'CANCELADO'
                              ? 'verde'
                              : 'roja'
                        }
                      >
                        {prestamo.estado}
                      </Etiqueta>
                    </td>
                    <td>
                      <button
                        className="boton boton-secundario boton-pequeno"
                        type="button"
                        onClick={() => void verCronograma(prestamo)}
                      >
                        Cronograma
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {seleccion ? (
        <article className="tarjeta">
          <div className="encabezado-tarjeta">
            <h2>Cronograma de {seleccion.prestamo.persona}</h2>
            <div className="acciones">
              <button
                className="boton boton-secundario boton-pequeno"
                type="button"
                onClick={() => void alternarTipo()}
              >
                Cambiar a{' '}
                {seleccion.prestamo.estrictoCumplimiento
                  ? 'flexible'
                  : 'estricto'}
              </button>
              <button
                className="boton boton-secundario boton-pequeno"
                type="button"
                onClick={() => setSeleccion(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
          <dl className="detalle-lista">
            <div>
              <dt>Capital</dt>
              <dd>
                {formatearMoneda(
                  seleccion.prestamo.capitalCentimos,
                  seleccion.prestamo.moneda,
                )}
              </dd>
            </div>
            <div>
              <dt>Plazo</dt>
              <dd>{seleccion.prestamo.plazoMeses} meses</dd>
            </div>
            <div>
              <dt>Tasa mensual</dt>
              <dd>{seleccion.prestamo.tasaMensual}%</dd>
            </div>
            <div>
              <dt>Cumplimiento</dt>
              <dd>
                {seleccion.prestamo.estrictoCumplimiento
                  ? 'Estricto'
                  : 'Flexible'}
              </dd>
            </div>
          </dl>
          <div className="tabla-contenedor" style={{ marginTop: '0.8rem' }}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Vencimiento</th>
                  <th className="numero">Capital</th>
                  <th className="numero">Interés</th>
                  <th className="numero">Cuota</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {seleccion.cuotas.map((cuota) => (
                  <tr key={cuota.id}>
                    <td>{cuota.numeroCuota}</td>
                    <td>{formatearFecha(cuota.fechaVencimiento)}</td>
                    <td className="numero">
                      {formatearMoneda(
                        cuota.capitalProgramadoCentimos,
                        seleccion.prestamo.moneda,
                      )}
                    </td>
                    <td className="numero">
                      {formatearMoneda(
                        cuota.interesProgramadoCentimos,
                        seleccion.prestamo.moneda,
                      )}
                    </td>
                    <td className="numero">
                      {formatearMoneda(
                        cuota.montoProgramadoCentimos,
                        seleccion.prestamo.moneda,
                      )}
                    </td>
                    <td>
                      <Etiqueta
                        color={
                          cuota.estado === 'PAGADA'
                            ? 'verde'
                            : cuota.estado === 'PARCIAL'
                              ? 'ambar'
                              : 'gris'
                        }
                      >
                        {cuota.estado}
                      </Etiqueta>
                    </td>
                    <td>
                      {!seleccion.prestamo.estrictoCumplimiento &&
                      cuota.estado !== 'PAGADA' ? (
                        <button
                          className="boton boton-secundario boton-pequeno"
                          type="button"
                          onClick={() => {
                            setAjuste({
                              cuotaId: cuota.id,
                              numero: cuota.numeroCuota,
                              monto: (
                                cuota.montoProgramadoCentimos / 100
                              ).toFixed(2),
                              motivo: '',
                              redistribucion: 'EQUITATIVA',
                            });
                            setErrorAjuste(null);
                            setMensajeAjuste(null);
                          }}
                        >
                          Ajustar
                        </button>
                      ) : (
                        <span className="nota">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ajuste ? (
            <div style={{ marginTop: '0.9rem' }}>
              <h3>Ajustar cuota {ajuste.numero}</h3>
              <div className="formulario">
                <Campo etiqueta="Nuevo monto">
                  <input
                    inputMode="decimal"
                    value={ajuste.monto}
                    onChange={(e) =>
                      setAjuste({ ...ajuste, monto: e.target.value })
                    }
                  />
                </Campo>
                <Campo etiqueta="Redistribuir en">
                  <select
                    value={ajuste.redistribucion}
                    onChange={(e) =>
                      setAjuste({
                        ...ajuste,
                        redistribucion: e.target.value as
                          | 'EQUITATIVA'
                          | 'ULTIMA',
                      })
                    }
                  >
                    <option value="EQUITATIVA">Cuotas posteriores</option>
                    <option value="ULTIMA">Última cuota</option>
                  </select>
                </Campo>
                <Campo etiqueta="Motivo *">
                  <input
                    value={ajuste.motivo}
                    onChange={(e) =>
                      setAjuste({ ...ajuste, motivo: e.target.value })
                    }
                  />
                </Campo>
                <div className="acciones">
                  <button
                    className="boton boton-primario boton-pequeno"
                    type="button"
                    onClick={() => void guardarAjuste()}
                  >
                    Guardar ajuste
                  </button>
                  <button
                    className="boton boton-secundario boton-pequeno"
                    type="button"
                    onClick={() => setAjuste(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {errorAjuste ? (
            <div style={{ marginTop: '0.7rem' }}>
              <Aviso tipo="error">{errorAjuste}</Aviso>
            </div>
          ) : null}
          {mensajeAjuste ? (
            <div style={{ marginTop: '0.7rem' }}>
              <Aviso tipo="exito">{mensajeAjuste}</Aviso>
            </div>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
