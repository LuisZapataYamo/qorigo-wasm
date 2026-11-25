import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos.css';
import { db } from './db/baseDatos';
import { asegurarSemilla } from './db/semilla';

asegurarSemilla(db).catch((error) => {
  console.error('No se pudo preparar la base local', error);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
