import { useState, type FormEvent } from 'react';
import {
  simularPrestamo,
  type SimulacionPrestamo,
} from '../../aplicacion/prestamos';
import { formatearMoneda } from '../../dominio/dinero';
import { formatearFecha, hoy, sumarMeses } from '../../dominio/fechas';
import { mensajeDeError } from '../../dominio/errores';
import { Aviso, Campo } from '../componentes';

export function Prestamos() {
  const [formulario, setFormulario] = useState({
    capital: '2000.00',
    tasaMensual: '5',
    plazoMeses: '6',
    fechaPrimerPago: sumarMeses(hoy(), 1),
  });
  const [simulacion, setSimulacion] = useState<SimulacionPrestamo | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    </section>
  );
}
