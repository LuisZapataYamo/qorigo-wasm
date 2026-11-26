import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../infraestructura/persistencia/baseDatos';
import { consultarVistaPersona } from '../../aplicacion/portal';
import { formatearMoneda } from '../../dominio/dinero';
import { formatearFecha, etiquetaPeriodo } from '../../dominio/fechas';
import { nombreCompleto } from '../../dominio/nombres';
import { Aviso, Campo, Cargando, Etiqueta, Vacio } from '../componentes';

export function Portal() {
  const [personaId, setPersonaId] = useState('');

  const personas = useLiveQuery(
    () =>
      db.personas.toArray().then((lista) =>
        lista
          .slice()
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

  const vista = useLiveQuery(
    () => (personaId ? consultarVistaPersona(db, personaId) : undefined),
    [personaId],
  );

  return (
    <section className="pagina">
      <div className="pagina-encabezado">
        <div>
          <h1>Vista por persona</h1>
          <p>
            Consulta de solo lectura de las suscripciones, cuotas, pagos y
            saldos de una persona. Adaptación local del portal del miembro: no
            hay cuentas remotas ni permisos de servidor.
          </p>
        </div>
      </div>

      <article className="tarjeta">
        <div className="fila-filtros">
          <Campo etiqueta="Persona">
            <select
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {(personas ?? []).map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {nombreCompleto(persona.apellidos, persona.nombres)}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Aviso tipo="info">
          Esta vista no permite registrar ni modificar nada. Para operar, usa
          las secciones de administración de este mismo dispositivo.
        </Aviso>
      </article>

      {!personaId ? (
        <Vacio>Selecciona una persona para ver su información.</Vacio>
      ) : vista === undefined ? (
        <Cargando />
      ) : (
        <>
          <article className="tarjeta">
            <div className="encabezado-tarjeta">
              <h2>
                {nombreCompleto(vista.persona.nombres, vista.persona.apellidos)}
              </h2>
              <Etiqueta color={vista.persona.activo ? 'verde' : 'roja'}>
                {vista.persona.activo ? 'ACTIVA' : 'INACTIVA'}
              </Etiqueta>
            </div>
            <dl className="detalle-lista">
              <div>
                <dt>Documento</dt>
                <dd>{vista.persona.documento ?? '—'}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{vista.persona.telefono ?? '—'}</dd>
              </div>
              {vista.deudaPorMoneda.length === 0 ? (
                <div>
                  <dt>Deuda</dt>
                  <dd>Sin deuda pendiente</dd>
                </div>
              ) : (
                vista.deudaPorMoneda.map((deuda) => (
                  <div key={deuda.moneda}>
                    <dt>Deuda en {deuda.moneda}</dt>
                    <dd>{formatearMoneda(deuda.centimos, deuda.moneda)}</dd>
                  </div>
                ))
              )}
            </dl>
          </article>

          <article className="tarjeta">
            <h2>Suscripciones</h2>
            {vista.suscripciones.length === 0 ? (
              <Vacio>Sin suscripciones.</Vacio>
            ) : (
              vista.suscripciones.map((suscripcion) => (
                <div key={suscripcion.id} style={{ marginBottom: '1rem' }}>
                  <div className="encabezado-tarjeta">
                    <h3>{suscripcion.nombre}</h3>
                    <span className="nota">
                      Acordado{' '}
                      {formatearMoneda(
                        suscripcion.montoAcordadoCentimos,
                        suscripcion.moneda,
                      )}{' '}
                      · Saldo{' '}
                      {formatearMoneda(
                        suscripcion.saldoCentimos,
                        suscripcion.moneda,
                      )}
                    </span>
                  </div>
                  <div className="tabla-contenedor">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Periodo</th>
                          <th>Vencimiento</th>
                          <th className="numero">Monto</th>
                          <th className="numero">Pagado</th>
                          <th className="numero">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suscripcion.cargos.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="nota">
                              Sin cargos generados.
                            </td>
                          </tr>
                        ) : (
                          suscripcion.cargos.map((cargo) => (
                            <tr key={cargo.id}>
                              <td>{etiquetaPeriodo(cargo.periodo)}</td>
                              <td>{formatearFecha(cargo.fechaVencimiento)}</td>
                              <td className="numero">
                                {formatearMoneda(
                                  cargo.montoCentimos,
                                  suscripcion.moneda,
                                )}
                              </td>
                              <td className="numero">
                                {formatearMoneda(
                                  cargo.pagadoCentimos,
                                  suscripcion.moneda,
                                )}
                              </td>
                              <td className="numero">
                                {formatearMoneda(
                                  cargo.saldoCentimos,
                                  suscripcion.moneda,
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </article>

          <article className="tarjeta">
            <h2>Préstamos</h2>
            {vista.prestamos.length === 0 ? (
              <Vacio>Sin préstamos.</Vacio>
            ) : (
              vista.prestamos.map((prestamo) => (
                <div key={prestamo.id} style={{ marginBottom: '1rem' }}>
                  <div className="encabezado-tarjeta">
                    <h3>
                      {formatearMoneda(prestamo.capitalCentimos, prestamo.moneda)}{' '}
                      · {prestamo.plazoMeses} meses
                    </h3>
                    <Etiqueta color={prestamo.estado === 'ACTIVO' ? 'azul' : 'gris'}>
                      {prestamo.estado}
                    </Etiqueta>
                  </div>
                  <div className="tabla-contenedor">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>N°</th>
                          <th>Vencimiento</th>
                          <th className="numero">Cuota</th>
                          <th className="numero">Pagado</th>
                          <th className="numero">Saldo</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prestamo.cuotas.map((cuota) => (
                          <tr key={cuota.id}>
                            <td>{cuota.numeroCuota}</td>
                            <td>{formatearFecha(cuota.fechaVencimiento)}</td>
                            <td className="numero">
                              {formatearMoneda(
                                cuota.montoCentimos,
                                prestamo.moneda,
                              )}
                            </td>
                            <td className="numero">
                              {formatearMoneda(
                                cuota.pagadoCentimos,
                                prestamo.moneda,
                              )}
                            </td>
                            <td className="numero">
                              {formatearMoneda(
                                cuota.saldoCentimos,
                                prestamo.moneda,
                              )}
                            </td>
                            <td>{cuota.estado}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </article>

          <article className="tarjeta">
            <h2>Pagos</h2>
            {vista.pagos.length === 0 ? (
              <Vacio>Sin pagos registrados.</Vacio>
            ) : (
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Método</th>
                      <th>Referencia</th>
                      <th className="numero">Monto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vista.pagos.map((pago) => (
                      <tr key={pago.id}>
                        <td>{formatearFecha(pago.fechaPago)}</td>
                        <td>{pago.metodoPago}</td>
                        <td>{pago.referencia ?? '—'}</td>
                        <td className="numero">
                          {formatearMoneda(pago.montoCentimos, pago.moneda)}
                        </td>
                        <td>{pago.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      )}
    </section>
  );
}
