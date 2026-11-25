import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useRecordatoriosAutomaticos } from './useRecordatorios';

const ENLACES = [
  { a: '/', texto: 'Inicio', icono: '⌂' },
  { a: '/personas', texto: 'Personas', icono: '☺' },
  { a: '/suscripciones', texto: 'Suscripciones', icono: '▤' },
  { a: '/prestamos', texto: 'Préstamos', icono: '↔' },
  { a: '/pagos', texto: 'Pagos', icono: '✓' },
  { a: '/informes', texto: 'Informes', icono: '◫' },
  { a: '/portal', texto: 'Por persona', icono: '☰' },
  { a: '/respaldo', texto: 'Respaldo', icono: '⇅' },
  { a: '/configuracion', texto: 'Configuración', icono: '⚙' },
];

export function Disposicion() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const ubicacion = useLocation();
  useRecordatoriosAutomaticos();

  // Al cambiar de sección el listado móvil se cierra solo.
  useEffect(() => {
    setMenuAbierto(false);
  }, [ubicacion.pathname]);

  // Escape cierra el menú desplegable.
  useEffect(() => {
    if (!menuAbierto) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMenuAbierto(false);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [menuAbierto]);

  return (
    <div className="disposicion">
      <header className="cabecera">
        <div className="marca">
          <span className="marca-icono">Q</span>
          <div>
            <strong>QoriGo</strong>
            <small>Datos solo en este dispositivo</small>
          </div>
        </div>

        <div className="cabecera-acciones">
          <span className="insignia-local">IndexedDB</span>
          <button
            type="button"
            className="boton-menu"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuAbierto}
            aria-controls="menu-principal"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
          >
            <span className="lineas-menu" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </header>

      {menuAbierto ? (
        <div
          className="menu-fondo"
          aria-hidden="true"
          onClick={() => setMenuAbierto(false)}
        />
      ) : null}

      <nav
        id="menu-principal"
        className={`navegacion${menuAbierto ? ' abierta' : ''}`}
        aria-label="Secciones"
      >
        {ENLACES.map((enlace) => (
          <NavLink
            key={enlace.a}
            to={enlace.a}
            end={enlace.a === '/'}
            className={({ isActive }) => (isActive ? 'activo' : undefined)}
            onClick={() => setMenuAbierto(false)}
          >
            <span aria-hidden="true">{enlace.icono}</span>
            {enlace.texto}
          </NavLink>
        ))}
      </nav>

      <main className="contenido">
        <Outlet />
      </main>

      <footer className="pie">
        QoriGo · PWA local · Los datos no se envían a ningún servidor
      </footer>
    </div>
  );
}
