import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Disposicion } from './ui/Disposicion';
import { Inicio } from './ui/paginas/Inicio';
import { EnConstruccion } from './ui/paginas/EnConstruccion';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Disposicion />}>
          <Route index element={<Inicio />} />
          <Route
            path="personas"
            element={<EnConstruccion titulo="Personas" caso="CU-01 y CU-02" />}
          />
          <Route
            path="suscripciones"
            element={
              <EnConstruccion
                titulo="Suscripciones"
                caso="CU-03 a CU-06"
              />
            }
          />
          <Route
            path="prestamos"
            element={<EnConstruccion titulo="Préstamos" caso="CU-07 a CU-11" />}
          />
          <Route
            path="pagos"
            element={<EnConstruccion titulo="Pagos" caso="CU-12 a CU-16" />}
          />
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
