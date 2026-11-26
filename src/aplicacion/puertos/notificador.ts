export type EstadoPermiso = NotificationPermission | 'no_soportado';

export interface AvisoNotificacion {
  clave: string;
  titulo: string;
  cuerpo: string;
}

/**
 * Puerto de notificaciones. La aplicación no conoce si el adaptador usa la
 * API del navegador, un service worker o un doble de prueba.
 */
export interface Notificador {
  permiso(): EstadoPermiso;
  solicitarPermiso(): Promise<EstadoPermiso>;
  mostrar(aviso: AvisoNotificacion): Promise<void>;
}
