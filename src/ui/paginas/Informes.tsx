import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/baseDatos';
import {
  DEFINICIONES,
  dashboard,
} from '../../aplicacion/reportes';
import { formatearMoneda } from '../../dominio/dinero';
import {
  etiquetaPeriodo,
  periodoActual,
  periodoDe,
} from '../../dominio/fechas';
import { Cargando, Aviso } from '../componentes';

export function Informes() {
  const [mes, setMes] = useState(periodoActual().slice(0, 7));
  const [moneda, setMoneda] = useState('PEN');
  const periodo = periodoDe(`${mes}-01`);

  const monedas = useLiveQuery(() => db.monedas.toArray(), [], []);
  const tablero = useLiveQuery(
    () => dashboard(db, periodo, moneda),
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
        </>
      )}
    </section>
  );
}
