import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Disposicion } from './ui/Disposicion';
import { Inicio } from './ui/paginas/Inicio';
import { EnConstruccion } from './ui/paginas/EnConstruccion';
import { Personas } from './ui/paginas/Personas';
import { Suscripciones } from './ui/paginas/Suscripciones';
import { Prestamos } from './ui/paginas/Prestamos';
import { Pagos } from './ui/paginas/Pagos';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Disposicion />}>
          <Route index element={<Inicio />} />
          <Route path="personas" element={<Personas />} />
          <Route path="suscripciones" element={<Suscripciones />} />
          <Route path="prestamos" element={<Prestamos />} />
          <Route path="pagos" element={<Pagos />} />
          <Route
            path="informes"
            element={<EnConstruccion titulo="Informes" caso="CU-17 a CU-21" />}
          />
          <Route
            path="respaldo"
            element={<EnConstruccion titulo="Respaldo" caso="CU-25 y CU-26" />}
          />
          <Route
            path="portal"
            element={<EnConstruccion titulo="Vista por persona" caso="CU-22" />}
          />
          <Route
            path="configuracion"
            element={<EnConstruccion titulo="Configuración" caso="CU-23" />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
