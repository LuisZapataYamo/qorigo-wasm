import { NavLink, Outlet } from 'react-router-dom';

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
        <span className="insignia-local">IndexedDB</span>
      </header>

      <nav className="navegacion" aria-label="Secciones">
        {ENLACES.map((enlace) => (
          <NavLink
            key={enlace.a}
            to={enlace.a}
            end={enlace.a === '/'}
            className={({ isActive }) => (isActive ? 'activo' : undefined)}
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
