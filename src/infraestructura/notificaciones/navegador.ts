import type {
  AvisoNotificacion,
  EstadoPermiso,
  Notificador,
} from '../../aplicacion/puertos/notificador';

export function notificacionesSoportadas(): boolean {
  return typeof Notification !== 'undefined';
}

export function permisoNotificaciones(): EstadoPermiso {
  if (!notificacionesSoportadas()) return 'no_soportado';
  return Notification.permission;
}

export async function solicitarPermisoNotificaciones(): Promise<EstadoPermiso> {
  if (!notificacionesSoportadas()) return 'no_soportado';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export async function mostrarNotificacionNavegador(
  aviso: AvisoNotificacion,
): Promise<void> {
  if (!notificacionesSoportadas()) {
    throw new Error('Este navegador no admite notificaciones.');
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Falta el permiso de notificaciones.');
  }

  const opciones: NotificationOptions = {
    body: aviso.cuerpo,
    icon: './icono-192.png',
    badge: './icono-192.png',
    tag: aviso.clave,
    data: { url: './#/pagos' },
  };

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registro = await navigator.serviceWorker.getRegistration();
    if (registro?.active) {
      await registro.showNotification(aviso.titulo, opciones);
      return;
    }
  }

  new Notification(aviso.titulo, opciones);
}

/** Adaptador de notificaciones del navegador (Web Notifications + SW). */
export const notificadorNavegador: Notificador = {
  permiso: permisoNotificaciones,
  solicitarPermiso: solicitarPermisoNotificaciones,
  mostrar: mostrarNotificacionNavegador,
};
