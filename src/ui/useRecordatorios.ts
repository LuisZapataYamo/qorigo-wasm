import { useEffect } from 'react';
import { db } from '../db/baseDatos';
import { ejecutarRecordatorios } from '../aplicacion/notificaciones';
import { notificadorNavegador } from '../infraestructura/notificaciones/navegador';

let revisionEnCurso = false;

async function revisarRecordatorios(): Promise<void> {
  if (revisionEnCurso) return;
  revisionEnCurso = true;
  try {
    await ejecutarRecordatorios(db, {
      notificador: notificadorNavegador,
    });
  } catch (error) {
    console.warn('No se pudieron revisar los recordatorios', error);
  } finally {
    revisionEnCurso = false;
  }
}

/**
 * Revisa recordatorios al abrir la app, cada 15 minutos y al volver a la
 * pestaña. No requiere internet; todo se calcula en el dispositivo.
 */
export function useRecordatoriosAutomaticos(): void {
  useEffect(() => {
    const inicio = window.setTimeout(() => {
      void revisarRecordatorios();
    }, 1500);
    const intervalo = window.setInterval(
      () => void revisarRecordatorios(),
      15 * 60 * 1000,
    );
    const alVolver = () => {
      if (document.visibilityState === 'visible') {
        void revisarRecordatorios();
      }
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearTimeout(inicio);
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);
}
