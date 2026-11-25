import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/baseDatos';
import {
  DEFINICIONES,
  dashboard,
  informePerdidasSuscripciones,
  informePrestamos,
  informeSuscripciones,
  prestamosACsv,
  rentabilidad,
  rentabilidadACsv,
  cobranza,
  cobranzaACsv,
  suscripcionesACsv,
} from '../../aplicacion/reportes';
import { formatearMoneda } from '../../dominio/dinero';
import {
  etiquetaPeriodo,
  periodoActual,
  periodoDe,
} from '../../dominio/fechas';
import { Cargando, Aviso, Etiqueta } from '../componentes';

function descargarCsv(nombre: string, contenido: string) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

export function Informes() {
  const [mes, setMes] = useState(periodoActual().slice(0, 7));
  const [moneda, setMoneda] = useState('PEN');
  const periodo = periodoDe(`${mes}-01`);

  const monedas = useLiveQuery(() => db.monedas.toArray(), [], []);
  const tablero = useLiveQuery(
    () => dashboard(db, periodo, moneda),
    [periodo, moneda],
  );
  const suscripciones = useLiveQuery(
    () => informeSuscripciones(db, periodo, moneda),
    [periodo, moneda],
  );
  const perdidasSuscripciones = useLiveQuery(
    () => informePerdidasSuscripciones(db, periodo, moneda),
    [periodo, moneda],
  );
  const prestamos = useLiveQuery(
    () => informePrestamos(db, moneda),
    [moneda],
  );
  const rentabilidadMes = useLiveQuery(
    () => rentabilidad(db, periodo, moneda),
    [periodo, moneda],
  );
  const cobranzaMes = useLiveQuery(
    () => cobranza(db, periodo, moneda),
    [periodo, moneda],
  );

  return (
    <section className="pagina">
      <div className="pagina-encabezado">
        <div>
          <h1>Informes y dashboard</h1>
          <p>
            Balance de caja y resultado económico se muestran por separado:
            desembolsar un préstamo reduce la caja, pero no es una pérdida.
          </p>
        </div>
      </div>

      <article className="tarjeta">
        <div className="fila-filtros">
          <label className="campo">
            <span>Periodo</span>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
            />
          </label>
          <label className="campo">
            <span>Moneda</span>
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
          </label>
        </div>
        <p className="nota">
          Los informes no convierten monedas: cada cifra corresponde a{' '}
          <strong>{moneda}</strong>. Periodo seleccionado:{' '}
          {etiquetaPeriodo(periodo)}.
        </p>
      </article>

      {tablero === undefined ? (
        <Cargando />
      ) : (
        <>
          <div className="rejilla-metricas">
            <article
              className={`metrica ${tablero.balance.balanceCajaCentimos < 0 ? 'negativo' : 'positivo'}`}
              title={DEFINICIONES.balanceCaja}
            >
              <span>Balance de caja</span>
              <strong>
                {formatearMoneda(
                  tablero.balance.balanceCajaCentimos,
                  moneda,
                )}
              </strong>
            </article>
            <article
              className={`metrica ${tablero.balance.resultadoEconomicoCentimos < 0 ? 'negativo' : 'positivo'}`}
              title={DEFINICIONES.resultadoEconomico}
            >
              <span>Resultado económico</span>
              <strong>
                {formatearMoneda(
                  tablero.balance.resultadoEconomicoCentimos,
                  moneda,
                )}
              </strong>
            </article>
            <article
              className="metrica"
              title={DEFINICIONES.rentabilidad}
            >
              <span>Rentabilidad</span>
              <strong>{tablero.balance.rentabilidadPorcentaje}%</strong>
            </article>
            <article
              className="metrica"
              title={DEFINICIONES.capitalEnLaCalle}
            >
              <span>Capital en la calle</span>
              <strong>
                {formatearMoneda(
                  tablero.balance.capitalEnLaCalleCentimos,
                  moneda,
                )}
              </strong>
            </article>
          </div>

          <div className="rejilla-tres">
            <article className="metrica">
              <span>Ingresos del mes</span>
              <strong>
                {formatearMoneda(tablero.balance.ingresosCentimos, moneda)}
              </strong>
              <small className="nota">
                Suscripciones{' '}
                {formatearMoneda(
                  tablero.balance.ingresoSuscripcionesCentimos,
                  moneda,
                )}{' '}
                · Préstamos{' '}
                {formatearMoneda(
                  tablero.balance.ingresoPrestamosCentimos,
                  moneda,
                )}
              </small>
            </article>
            <article className="metrica">
              <span>Egresos del mes</span>
              <strong>
                {formatearMoneda(tablero.balance.egresosCentimos, moneda)}
              </strong>
              <small className="nota">
                Costos{' '}
                {formatearMoneda(
                  tablero.balance.egresoCostosCentimos,
                  moneda,
                )}{' '}
                · Desembolsos{' '}
                {formatearMoneda(
                  tablero.balance.egresoDesembolsosCentimos,
                  moneda,
                )}
              </small>
            </article>
            <article className="metrica" title={DEFINICIONES.exigible}>
              <span>Exigible del mes</span>
              <strong>
                {formatearMoneda(
                  tablero.indicadores.exigibleTotalCentimos,
                  moneda,
                )}
              </strong>
              <small className="nota">
                Suscripciones{' '}
                {formatearMoneda(
                  tablero.indicadores.exigibleSuscripcionesCentimos,
                  moneda,
                )}{' '}
                · Préstamos{' '}
                {formatearMoneda(
                  tablero.indicadores.exigiblePrestamosCentimos,
                  moneda,
                )}
              </small>
            </article>
            <article className="metrica">
              <span>Cobrado del mes</span>
              <strong>
                {formatearMoneda(
                  tablero.indicadores.cobradoMesCentimos,
                  moneda,
                )}
              </strong>
            </article>
            <article
              className="metrica"
              title={DEFINICIONES.porcentajeCobranza}
            >
              <span>% de cobranza</span>
              <strong>{tablero.indicadores.porcentajeCobranza}%</strong>
            </article>
            <article className="metrica">
              <span>Total vencido</span>
              <strong>
                {formatearMoneda(
                  tablero.indicadores.totalVencidoCentimos,
                  moneda,
                )}
              </strong>
            </article>
          </div>

          <article className="tarjeta">
            <h2>Últimos 12 meses</h2>
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Periodo</th>
                    <th className="numero">Ingresos</th>
                    <th className="numero">Egresos</th>
                    <th className="numero">Balance de caja</th>
                    <th className="numero">Resultado económico</th>
                  </tr>
                </thead>
                <tbody>
                  {tablero.serie.map((linea) => (
                    <tr key={linea.periodo}>
                      <td>{etiquetaPeriodo(linea.periodo)}</td>
                      <td className="numero">
                        {formatearMoneda(linea.ingresosCentimos, moneda)}
                      </td>
                      <td className="numero">
                        {formatearMoneda(linea.egresosCentimos, moneda)}
                      </td>
                      <td className="numero">
                        {formatearMoneda(linea.balanceCajaCentimos, moneda)}
                      </td>
                      <td className="numero">
                        {formatearMoneda(
                          linea.resultadoEconomicoCentimos,
                          moneda,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <div className="rejilla-dos">
            <article className="tarjeta">
              <h2>Alertas</h2>
              {tablero.alertas.suscripcionesEnPerdida.length === 0 &&
              tablero.alertas.prestamosEnRiesgo.length === 0 &&
              tablero.alertas.cuotasPorVencer.length === 0 ? (
                <p className="nota">Sin alertas para este periodo.</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {tablero.alertas.suscripcionesEnPerdida.map((alerta) => (
                    <Aviso key={alerta.suscripcionId} tipo="alerta">
                      Suscripción en pérdida: {alerta.nombre} (
                      {formatearMoneda(alerta.margenRealCentimos, moneda)}).
                    </Aviso>
                  ))}
                  {tablero.alertas.prestamosEnRiesgo.map((alerta) => (
                    <Aviso key={alerta.prestamoId} tipo="error">
                      Préstamo en riesgo: {alerta.persona} ·{' '}
                      {alerta.diasMaxAtraso} días de atraso ·{' '}
                      {formatearMoneda(alerta.saldoVencidoCentimos, moneda)}.
                    </Aviso>
                  ))}
                  {tablero.alertas.cuotasPorVencer.map((alerta) => (
                    <Aviso key={alerta.cuotaId} tipo="info">
                      Cuota por vencer: {alerta.persona} ·{' '}
                      {alerta.fechaVencimiento} ·{' '}
                      {formatearMoneda(alerta.saldoCentimos, moneda)}.
                    </Aviso>
                  ))}
                </div>
              )}
            </article>

            <article className="tarjeta">
              <h2>Cómo leer estas cifras</h2>
              <ul className="lista-pasos">
                <li>{DEFINICIONES.balanceCaja}</li>
                <li>{DEFINICIONES.resultadoEconomico}</li>
                <li>{DEFINICIONES.rentabilidad}</li>
                <li>{DEFINICIONES.capitalEnLaCalle}</li>
              </ul>
            </article>
          </div>

          <article className="tarjeta">
            <div className="encabezado-tarjeta">
              <h2>Suscripciones del periodo</h2>
              <button
                className="boton boton-secundario boton-pequeno"
                type="button"
                disabled={!suscripciones || suscripciones.length === 0}
                onClick={() =>
                  descargarCsv(
                    `suscripciones-${periodo.slice(0, 7)}-${moneda}.csv`,
                    suscripcionesACsv(suscripciones ?? []),
                  )
                }
              >
                Exportar CSV
              </button>
            </div>
            {!suscripciones ? (
              <Cargando />
            ) : suscripciones.length === 0 ? (
              <p className="nota">
                No hay costos generados para este periodo. Genera el periodo
                desde Suscripciones.
              </p>
            ) : (
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Suscripción</th>
                      <th className="numero">Costo</th>
                      <th className="numero">Esperado</th>
                      <th className="numero">Cobrado</th>
                      <th className="numero">Margen real</th>
                      <th className="numero">Margen proyectado</th>
                      <th>Causa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suscripciones.map((linea) => (
                      <tr key={linea.suscripcionId}>
                        <td>
                          <strong>{linea.nombre}</strong>
                          <div className="nota">{linea.plataforma}</div>
                        </td>
                        <td className="numero">
                          {formatearMoneda(linea.costoCentimos, moneda)}
                        </td>
                        <td className="numero">
                          {formatearMoneda(linea.esperadoCentimos, moneda)}
                        </td>
                        <td className="numero">
                          {formatearMoneda(linea.cobradoCentimos, moneda)}
                        </td>
                        <td className="numero">
                          {formatearMoneda(linea.margenRealCentimos, moneda)}
                        </td>
                        <td className="numero">
                          {formatearMoneda(
                            linea.margenProyectadoCentimos,
                            moneda,
                          )}
                        </td>
                        <td>
                          {linea.causaPerdida ? (
                            <Etiqueta color="roja">
                              {linea.causaPerdida}
                            </Etiqueta>
                          ) : (
                            <Etiqueta color="verde">SIN PÉRDIDA</Etiqueta>
                          )}
                          {linea.esUsoPersonal ? (
                            <div>
                              <Etiqueta color="azul">USO PERSONAL</Etiqueta>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="tarjeta">
            <h2>Pérdidas por suscripción</h2>
            {(perdidasSuscripciones ?? []).length === 0 ? (
              <p className="nota">No hay suscripciones en pérdida.</p>
            ) : (
              (perdidasSuscripciones ?? []).map((linea) => (
                <div key={linea.suscripcionId} style={{ marginBottom: '1rem' }}>
                  <div className="encabezado-tarjeta">
                    <h3>
                      {linea.nombre} ·{' '}
                      {linea.causaPerdida === 'TARIFA'
                        ? 'la tarifa no cubre el costo'
                        : linea.causaPerdida === 'MOROSIDAD'
                          ? 'morosidad'
                          : 'tarifa y morosidad'}
                    </h3>
                    <span className="nota">
                      Margen real{' '}
                      {formatearMoneda(linea.margenRealCentimos, moneda)}
                    </span>
                  </div>
                  <div className="tabla-contenedor">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Miembro</th>
                          <th className="numero">Acordado</th>
                          <th className="numero">Pagado</th>
                          <th className="numero">Saldo</th>
                          <th className="numero">Costo por plaza</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {linea.miembros.map((miembro) => (
                          <tr key={miembro.personaId}>
                            <td>{miembro.nombre}</td>
                            <td className="numero">
                              {formatearMoneda(
                                miembro.montoCentimos,
                                moneda,
                              )}
                            </td>
                            <td className="numero">
                              {formatearMoneda(
                                miembro.pagadoCentimos,
                                moneda,
                              )}
                            </td>
                            <td className="numero">
                              {formatearMoneda(
                                miembro.saldoCentimos,
                                moneda,
                              )}
                            </td>
                            <td className="numero">
                              {formatearMoneda(
                                miembro.costoPorPlazaCentimos,
                                moneda,
                              )}
                            </td>
                            <td>
                              {miembro.aportaMenosQueCosto ? (
                                <Etiqueta color="ambar">
                                  APORTA MENOS
                                </Etiqueta>
                              ) : null}
                            </td>
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
            <div className="encabezado-tarjeta">
              <h2>Préstamos</h2>
              <button
                className="boton boton-secundario boton-pequeno"
                type="button"
                disabled={!prestamos || prestamos.length === 0}
                onClick={() =>
                  descargarCsv(
                    `prestamos-${moneda}.csv`,
                    prestamosACsv(prestamos ?? []),
                  )
                }
              >
                Exportar CSV
              </button>
            </div>
            {(prestamos ?? []).length === 0 ? (
              <p className="nota">No hay préstamos registrados.</p>
            ) : (
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th>Estado</th>
                      <th className="numero">Capital</th>
                      <th className="numero">Cobrado</th>
                      <th className="numero">Capital recup.</th>
                      <th className="numero">Interés</th>
                      <th className="numero">Saldo</th>
                      <th className="numero">Vencido</th>
                      <th className="numero">Atraso</th>
                      <th className="numero">Resultado</th>
                      <th>Marca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(prestamos ?? []).map((linea) => (
                      <tr key={linea.prestamoId}>
                        <td>{linea.persona}</td>
                        <td>{linea.estado}</td>
                        <td className="numero">
                          {formatearMoneda(linea.capitalCentimos, moneda)}
                        </td>
                        <td className="numero">
                          {formatearMoneda(
                            linea.totalCobradoCentimos,
                            moneda,
                          )}
                        </td>
                        <td className="numero">
                          {formatearMoneda(
                            linea.capitalRecuperadoCentimos,
                            moneda,
                          )}
                        </td>
                        <td className="numero">
                          {formatearMoneda(
                            linea.interesCobradoCentimos,
                            moneda,
                          )}
                        </td>
                        <td className="numero">
                          {formatearMoneda(
                            linea.saldoPendienteCentimos,
                            moneda,
                          )}
                        </td>
                        <td className="numero">
                          {formatearMoneda(linea.saldoVencidoCentimos, moneda)}
                        </td>
                        <td className="numero">{linea.diasMaxAtraso} d</td>
                        <td className="numero">
                          {formatearMoneda(linea.resultadoCentimos, moneda)}
                        </td>
                        <td>
                          {linea.marca === 'EN_RIESGO' ? (
                            <Etiqueta color="ambar">EN RIESGO</Etiqueta>
                          ) : linea.marca === 'EN_PERDIDA' ? (
                            <Etiqueta color="roja">EN PÉRDIDA</Etiqueta>
                          ) : (
                            <Etiqueta color="verde">—</Etiqueta>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="nota" style={{ marginTop: '0.5rem' }}>
              Un resultado negativo en un préstamo activo significa que aún no
              se recuperó el capital, no que sea pérdida.
            </p>
          </article>

          <article className="tarjeta">
            <div className="encabezado-tarjeta">
              <h2>Rentabilidad</h2>
              <button
                className="boton boton-secundario boton-pequeno"
                type="button"
                disabled={!rentabilidadMes}
                onClick={() =>
                  descargarCsv(
                    `rentabilidad-${periodo.slice(0, 7)}-${moneda}.csv`,
                    rentabilidadACsv(rentabilidadMes!),
                  )
                }
              >
                Exportar CSV
              </button>
            </div>
            {!rentabilidadMes ? (
              <Cargando />
            ) : (
              <>
                <dl className="detalle-lista">
                  <div>
                    <dt>Margen de suscripciones</dt>
                    <dd>
                      {formatearMoneda(
                        rentabilidadMes.margenSuscripcionesCentimos,
                        moneda,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Interés cobrado</dt>
                    <dd>
                      {formatearMoneda(
                        rentabilidadMes.interesCobradoCentimos,
                        moneda,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Pérdidas incobrables</dt>
                    <dd>
                      {formatearMoneda(
                        rentabilidadMes.perdidasIncobrablesCentimos,
                        moneda,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Resultado</dt>
                    <dd>
                      {formatearMoneda(
                        rentabilidadMes.resultadoCentimos,
                        moneda,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Rentabilidad</dt>
                    <dd>{rentabilidadMes.rentabilidadPorcentaje}%</dd>
                  </div>
                </dl>

                <div className="tabla-contenedor" style={{ marginTop: '0.8rem' }}>
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Origen</th>
                        <th>Nombre</th>
                        <th className="numero">Margen subs.</th>
                        <th className="numero">Interés</th>
                        <th className="numero">Pérdidas</th>
                        <th className="numero">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...rentabilidadMes.porSuscripcion,
                        ...rentabilidadMes.porPrestamo,
                        ...rentabilidadMes.porPersona,
                      ].map((linea) => (
                        <tr key={`${linea.tipo}-${linea.id}`}>
                          <td>
                            <Etiqueta
                              color={
                                linea.tipo === 'PERSONA'
                                  ? 'azul'
                                  : linea.tipo === 'PRESTAMO'
                                    ? 'ambar'
                                    : 'gris'
                              }
                            >
                              {linea.tipo}
                            </Etiqueta>
                          </td>
                          <td>{linea.nombre}</td>
                          <td className="numero">
                            {formatearMoneda(
                              linea.margenSuscripcionesCentimos,
                              moneda,
                            )}
                          </td>
                          <td className="numero">
                            {formatearMoneda(
                              linea.interesCobradoCentimos,
                              moneda,
                            )}
                          </td>
                          <td className="numero">
                            {formatearMoneda(linea.perdidasCentimos, moneda)}
                          </td>
                          <td className="numero">
                            {formatearMoneda(linea.resultadoCentimos, moneda)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </article>

          <article className="tarjeta">
            <div className="encabezado-tarjeta">
              <h2>Cobranza y cartera vencida</h2>
              <button
                className="boton boton-secundario boton-pequeno"
                type="button"
                disabled={!cobranzaMes}
                onClick={() =>
                  descargarCsv(
                    `cobranza-${periodo.slice(0, 7)}-${moneda}.csv`,
                    cobranzaACsv(cobranzaMes!),
                  )
                }
              >
                Exportar CSV
              </button>
            </div>
            {!cobranzaMes ? (
              <Cargando />
            ) : (
              <>
                <div className="rejilla-metricas">
                  <article className="metrica">
                    <span>Exigible suscripciones</span>
                    <strong>
                      {formatearMoneda(
                        cobranzaMes.exigibleSuscripcionesCentimos,
                        moneda,
                      )}
                    </strong>
                  </article>
                  <article className="metrica">
                    <span>Exigible préstamos</span>
                    <strong>
                      {formatearMoneda(
                        cobranzaMes.exigiblePrestamosCentimos,
                        moneda,
                      )}
                    </strong>
                  </article>
                  <article className="metrica">
                    <span>Exigible total</span>
                    <strong>
                      {formatearMoneda(
                        cobranzaMes.exigibleTotalCentimos,
                        moneda,
                      )}
                    </strong>
                  </article>
                  <article className="metrica">
                    <span>Vencido 1–30 días</span>
                    <strong>
                      {formatearMoneda(
                        cobranzaMes.antiguedad['1-30'],
                        moneda,
                      )}
                    </strong>
                  </article>
                  <article className="metrica">
                    <span>31–60 días</span>
                    <strong>
                      {formatearMoneda(
                        cobranzaMes.antiguedad['31-60'],
                        moneda,
                      )}
                    </strong>
                  </article>
                  <article className="metrica">
                    <span>61–90 días</span>
                    <strong>
                      {formatearMoneda(
                        cobranzaMes.antiguedad['61-90'],
                        moneda,
                      )}
                    </strong>
                  </article>
                  <article className="metrica">
                    <span>Más de 90 días</span>
                    <strong>
                      {formatearMoneda(
                        cobranzaMes.antiguedad.MAS_90,
                        moneda,
                      )}
                    </strong>
                  </article>
                </div>

                <h3 style={{ marginTop: '1rem' }}>Préstamos del mes</h3>
                {cobranzaMes.prestamos.length === 0 ? (
                  <p className="nota">Sin préstamos exigibles.</p>
                ) : (
                  <div className="tabla-contenedor">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Persona</th>
                          <th>Tipo</th>
                          <th className="numero">Arrastre</th>
                          <th className="numero">Cuota del mes</th>
                          <th className="numero">Exigible</th>
                          <th className="numero">Atrasado no acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cobranzaMes.prestamos.map((linea) => (
                          <tr key={linea.prestamoId}>
                            <td>{linea.persona}</td>
                            <td>{linea.estricto ? 'Estricto' : 'Flexible'}</td>
                            <td className="numero">
                              {formatearMoneda(
                                linea.saldoAnteriorCentimos,
                                moneda,
                              )}
                            </td>
                            <td className="numero">
                              {formatearMoneda(
                                linea.cuotaMesCentimos,
                                moneda,
                              )}
                            </td>
                            <td className="numero">
                              {formatearMoneda(
                                linea.exigibleCentimos,
                                moneda,
                              )}
                            </td>
                            <td className="numero">
                              {formatearMoneda(
                                linea.atrasadoNoAcumuladoCentimos,
                                moneda,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h3 style={{ marginTop: '1rem' }}>Morosos</h3>
                {cobranzaMes.morosos.length === 0 ? (
                  <p className="nota">No hay obligaciones vencidas.</p>
                ) : (
                  <div className="tabla-contenedor">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Persona</th>
                          <th className="numero">Saldo vencido</th>
                          <th className="numero">Días de atraso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cobranzaMes.morosos.map((moroso) => (
                          <tr key={moroso.personaId}>
                            <td>{moroso.nombre}</td>
                            <td className="numero">
                              {formatearMoneda(moroso.saldoCentimos, moneda)}
                            </td>
                            <td className="numero">{moroso.diasMaxAtraso}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </article>
        </>
      )}
    </section>
  );
}
