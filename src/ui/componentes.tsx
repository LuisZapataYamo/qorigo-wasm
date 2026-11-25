import type { ReactNode } from 'react';

export type TipoAviso = 'info' | 'alerta' | 'error' | 'exito';

export function Aviso({
  tipo = 'info',
  children,
}: {
  tipo?: TipoAviso;
  children: ReactNode;
}) {
  return <div className={`aviso aviso-${tipo}`}>{children}</div>;
}

export function Etiqueta({
  color = 'gris',
  children,
}: {
  color?: 'gris' | 'verde' | 'roja' | 'ambar' | 'azul';
  children: ReactNode;
}) {
  return (
    <span className={`etiqueta${color === 'gris' ? '' : ` etiqueta-${color}`}`}>
      {children}
    </span>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <p className="cargando">{texto}</p>;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="vacio">{children}</p>;
}

export function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {children}
      {ayuda ? <small>{ayuda}</small> : null}
    </label>
  );
}

export function colorEstadoSuscripcion(
  estado: string,
): 'verde' | 'ambar' | 'roja' | 'gris' {
  if (estado === 'ACTIVA') return 'verde';
  if (estado === 'SUSPENDIDA') return 'ambar';
  if (estado === 'CANCELADA') return 'roja';
  return 'gris';
}

export function colorEstadoObligacion(
  estado: string,
): 'verde' | 'ambar' | 'roja' | 'gris' {
  if (estado === 'PAGADO' || estado === 'PAGADA') return 'verde';
  if (estado === 'PARCIAL') return 'ambar';
  if (estado === 'ANULADO') return 'roja';
  return 'gris';
}
