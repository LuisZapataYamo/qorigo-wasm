import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProteccionLocal } from './ui/ProteccionLocal';
import { Inicio } from './ui/paginas/Inicio';
import { EnConstruccion } from './ui/paginas/EnConstruccion';
import { Personas } from './ui/paginas/Personas';
import { Suscripciones } from './ui/paginas/Suscripciones';
import { Prestamos } from './ui/paginas/Prestamos';
import { Pagos } from './ui/paginas/Pagos';
import { Informes } from './ui/paginas/Informes';
import { Portal } from './ui/paginas/Portal';
import { Configuracion } from './ui/paginas/Configuracion';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<ProteccionLocal />}>
          <Route index element={<Inicio />} />
          <Route path="personas" element={<Personas />} />
          <Route path="suscripciones" element={<Suscripciones />} />
          <Route path="prestamos" element={<Prestamos />} />
          <Route path="pagos" element={<Pagos />} />
          <Route path="informes" element={<Informes />} />
          <Route
            path="respaldo"
            element={<EnConstruccion titulo="Respaldo" caso="CU-25 y CU-26" />}
          />
          <Route path="portal" element={<Portal />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
