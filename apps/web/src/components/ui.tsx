/* ==========================================================================
   Sistema de diseno
   --------------------------------------------------------------------------
   Reemplaza las ~4.000 lineas de style={{...}} inline del v0, donde cada
   pantalla repetia sus propios colores y medidas. Aqui cada pieza se define
   una vez y usa los tokens de packages/config/tailwind/tokens.css, que
   conservan exactamente la paleta original.
   ========================================================================== */

import type { ReactNode } from 'react';
import { formatearCOP } from '@terranova/shared';

/* --- Tarjeta ------------------------------------------------------------ */

export function Card({
  children, className = '', ...resto
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[--radius-card] border border-muted-200 bg-surface-raised shadow-[--shadow-card] ${className}`}
      {...resto}
    >
      {children}
    </div>
  );
}

export function CardEncabezado({
  titulo, descripcion, accion,
}: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-muted-200 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-ink-900">{titulo}</h2>
        {descripcion && <p className="mt-0.5 text-sm text-muted-600">{descripcion}</p>}
      </div>
      {accion}
    </div>
  );
}

/* --- Indicador numerico -------------------------------------------------- */

export function Indicador({
  etiqueta, valor, detalle, tono = 'neutro', icono,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  tono?: 'neutro' | 'exito' | 'alerta' | 'peligro' | 'marca';
  icono?: ReactNode;
}) {
  const tonos = {
    neutro: 'text-ink-900',
    marca: 'text-brand-700',
    exito: 'text-success-600',
    alerta: 'text-warning-600',
    peligro: 'text-danger-600',
  } as const;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-600">{etiqueta}</p>
          {/* tabular: mantiene las cifras alineadas entre tarjetas */}
          <p className={`tabular mt-1.5 text-2xl font-semibold ${tonos[tono]}`}>{valor}</p>
          {detalle && <p className="mt-1 text-xs text-muted-500">{detalle}</p>}
        </div>
        {icono && <div className="shrink-0 text-muted-400">{icono}</div>}
      </div>
    </Card>
  );
}

/* --- Distintivo de estado ------------------------------------------------ */

type Tono = 'neutro' | 'exito' | 'alerta' | 'peligro' | 'marca';

const TONOS_BADGE: Record<Tono, string> = {
  neutro: 'bg-muted-100 text-muted-700 ring-muted-200',
  marca: 'bg-brand-100 text-brand-900 ring-brand-100',
  exito: 'bg-success-100 text-success-800 ring-success-100',
  alerta: 'bg-warning-100 text-warning-800 ring-warning-100',
  peligro: 'bg-danger-100 text-danger-800 ring-danger-100',
};

export function Badge({
  children, tono = 'neutro',
}: { children: ReactNode; tono?: Tono }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONOS_BADGE[tono]}`}
    >
      {children}
    </span>
  );
}

/**
 * El color de cada estado se decide aqui, una sola vez. En el v0 el mismo
 * estado se pintaba con verdes distintos segun la pantalla.
 */
export const TONO_ESTADO_LOTE: Record<string, Tono> = {
  DISPONIBLE: 'exito',
  RESERVADO: 'alerta',
  VENDIDO: 'marca',
  PAGADO: 'exito',
  BLOQUEADO: 'neutro',
};

export const TONO_CARTERA: Record<string, Tono> = {
  PAGADO: 'exito',
  PARCIAL: 'marca',
  PENDIENTE: 'neutro',
  EN_MORA: 'peligro',
  ANULADA: 'neutro',
};

export const TONO_ESTADO_VENTA: Record<string, Tono> = {
  ACTIVA: 'marca',
  LIQUIDADA: 'exito',
  ANULADA: 'peligro',
};

/* --- Dinero -------------------------------------------------------------- */

/** Cifras siempre alineadas a la derecha y con numeros tabulares. */
export function Money({
  valor, className = '', tono,
}: { valor: string | number; className?: string; tono?: 'exito' | 'peligro' | 'alerta' }) {
  const tonos = {
    exito: 'text-success-600',
    peligro: 'text-danger-600',
    alerta: 'text-warning-600',
  } as const;
  return (
    <span className={`tabular ${tono ? tonos[tono] : ''} ${className}`}>
      {formatearCOP(valor)}
    </span>
  );
}

/* --- Tabla --------------------------------------------------------------- */

export function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

/** Celda de cabecera. `children` es opcional: la columna de acciones no lleva titulo. */
export function Th({
  children, alinear = 'left', className = '', ...resto
}: {
  children?: ReactNode;
  alinear?: 'left' | 'right' | 'center';
} & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`whitespace-nowrap border-b border-muted-200 bg-muted-100 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-600 text-${alinear} ${className}`}
      {...resto}
    >
      {children}
    </th>
  );
}

export function Td({
  children, alinear = 'left', className = '', ...resto
}: {
  children?: ReactNode;
  alinear?: 'left' | 'right' | 'center';
} & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={`border-b border-muted-200 px-3 py-2.5 text-${alinear} ${className}`}
      {...resto}
    >
      {children}
    </td>
  );
}

/**
 * Estado vacio explicito. El v0 mostraba una tabla sin filas, de modo que
 * no se distinguia "no hay datos" de "todavia esta cargando" ni de "fallo
 * la consulta".
 */
export function Vacio({
  titulo, descripcion, accion,
}: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink-900">{titulo}</p>
      {descripcion && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-500">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export function Aviso({
  tono = 'alerta', titulo, children,
}: { tono?: Tono; titulo?: string; children: ReactNode }) {
  const estilos: Record<Tono, string> = {
    neutro: 'bg-muted-100 text-muted-700 border-muted-200',
    marca: 'bg-brand-50 text-brand-900 border-brand-100',
    exito: 'bg-success-100 text-success-800 border-success-100',
    alerta: 'bg-warning-100 text-warning-800 border-warning-100',
    peligro: 'bg-danger-100 text-danger-800 border-danger-100',
  };
  return (
    <div className={`rounded-[--radius-card] border px-4 py-3 text-sm ${estilos[tono]}`}>
      {titulo && <p className="font-semibold">{titulo}</p>}
      <div className={titulo ? 'mt-0.5' : ''}>{children}</div>
    </div>
  );
}

/* --- Barra de progreso --------------------------------------------------- */

export function Progreso({ porcentaje, tono = 'marca' }: { porcentaje: number; tono?: Tono }) {
  const colores: Record<Tono, string> = {
    neutro: 'bg-muted-400',
    marca: 'bg-brand-600',
    exito: 'bg-success-600',
    alerta: 'bg-warning-500',
    peligro: 'bg-danger-600',
  };
  const ancho = Math.min(100, Math.max(0, porcentaje));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted-200"
      role="progressbar"
      aria-valuenow={Math.round(ancho)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full ${colores[tono]}`} style={{ width: `${ancho}%` }} />
    </div>
  );
}
