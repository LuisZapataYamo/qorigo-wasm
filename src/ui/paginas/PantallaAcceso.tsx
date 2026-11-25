import { useState, type FormEvent } from 'react';
import { db } from '../../db/baseDatos';
import { iniciarSesion } from '../../aplicacion/sesion';
import { mensajeDeError } from '../../dominio/errores';
import { Aviso } from '../componentes';

export function PantallaAcceso() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEntrando(true);
    try {
      await iniciarSesion(db, email, password);
      setPassword('');
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="pantalla-bloqueo">
      <form className="tarjeta pantalla-bloqueo-tarjeta" onSubmit={entrar}>
        <div className="marca" style={{ color: 'var(--ambar-900)' }}>
          <span
            className="marca-icono"
            style={{ background: 'var(--ambar-700)', color: '#fffbeb' }}
          >
            Q
          </span>
          <div>
            <strong>QoriGo</strong>
            <small style={{ color: 'var(--tinta-suave)' }}>
              Acceso local de este dispositivo
            </small>
          </div>
        </div>

        <label className="campo">
          <span>Correo</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? <Aviso tipo="error">{error}</Aviso> : null}

        <button
          className="boton boton-primario"
          type="submit"
          disabled={entrando}
        >
          {entrando ? 'Verificando…' : 'Entrar'}
        </button>
        <p className="nota">
          El acceso protege el uso casual de la aplicación. No hay
          recuperación por correo porque los datos no salen de este
          dispositivo.
        </p>
      </form>
    </div>
  );
}
