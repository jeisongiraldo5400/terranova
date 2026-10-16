/* ==========================================================================
   Sistema de diseno
   --------------------------------------------------------------------------
   Reemplaza las ~4.000 lineas de style={{...}} inline del v0, donde cada
   pantalla repetia sus propios colores y medidas. Cada pieza se define una
   vez y consume los tokens de packages/config/tailwind/tokens.css, que
   conservan la paleta original.
   ========================================================================== */

import type { ReactNode } from 'react';
import { formatearCOP } from '@terranova/shared';
import { IconoVacio } from './iconos';

/* --- Tarjeta ------------------------------------------------------------- */

export function Card({
  children, className = '', ...resto
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`overflow-hidden rounded-[--radius-card] bg-surface-raised shadow-[--shadow-card] ring-1 ring-muted-200/70 ${className}`}
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
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-muted-200/70 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[0.9375rem] font-semibold text-ink-900">{titulo}</h2>
        {descripcion && (
          <p className="mt-0.5 text-pretty text-xs leading-relaxed text-muted-500">{descripcion}</p>
        )}
      </div>
      {accion && <div className="flex shrink-0 flex-wrap gap-2">{accion}</div>}
    </div>
  );
}

/* --- Indicador numerico --------------------------------------------------- */

type Tono = 'neutro' | 'exito' | 'alerta' | 'peligro' | 'marca';

const TONO_TEXTO: Record<Tono, string> = {
  neutro: 'text-ink-900',
  marca: 'text-brand-700',
  exito: 'text-success-600',
  alerta: 'text-warning-600',
  peligro: 'text-danger-600',
};

const TONO_ICONO: Record<Tono, string> = {
  neutro: 'bg-muted-100 text-muted-500',
  marca: 'bg-brand-50 text-brand-600',
  exito: 'bg-success-50 text-success-600',
  alerta: 'bg-warning-50 text-warning-600',
  peligro: 'bg-danger-50 text-danger-600',
};

export function Indicador({
  etiqueta, valor, detalle, tono = 'neutro', icono,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  tono?: Tono;
  icono?: ReactNode;
}) {
  return (
    <Card className="transicion-suave p-5 hover:shadow-[--shadow-raised]">
      <div className="flex items-start gap-4">
        {icono && (
          <span className={`grid size-10 shrink-0 place-items-center rounded-[--radius-control] ${TONO_ICONO[tono]}`}>
            {icono}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-500">
            {etiqueta}
          </p>
          {/* tabular: las cifras quedan alineadas entre tarjetas */}
          <p className={`tabular mt-1.5 text-2xl font-semibold leading-none ${TONO_TEXTO[tono]}`}>
            {valor}
          </p>
          {/* Sin truncate: el detalle es la lectura que da sentido a la
              cifra ("29,5% de lo vendido"), cortarlo la deja sin contexto. */}
          {detalle && (
            <p className="mt-2 text-pretty text-xs leading-snug text-muted-400">{detalle}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

/* --- Distintivo de estado ------------------------------------------------- */

const TONOS_BADGE: Record<Tono, string> = {
  neutro: 'bg-muted-100 text-muted-600 ring-muted-200',
  marca: 'bg-brand-50 text-brand-700 ring-brand-100',
  exito: 'bg-success-50 text-success-700 ring-success-100',
  alerta: 'bg-warning-50 text-warning-800 ring-warning-100',
  peligro: 'bg-danger-50 text-danger-800 ring-danger-100',
};

const PUNTO: Record<Tono, string> = {
  neutro: 'bg-muted-400',
  marca: 'bg-brand-500',
  exito: 'bg-success-500',
  alerta: 'bg-warning-500',
  peligro: 'bg-danger-500',
};

export function Badge({
  children, tono = 'neutro', punto = false, title,
}: { children: ReactNode; tono?: Tono; punto?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ring-inset ${TONOS_BADGE[tono]}`}
    >
      {punto && <span className={`size-1.5 shrink-0 rounded-full ${PUNTO[tono]}`} aria-hidden />}
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

/* --- Dinero --------------------------------------------------------------- */

export function Money({
  valor, className = '', tono,
}: { valor: string | number; className?: string; tono?: 'exito' | 'peligro' | 'alerta' | 'tenue' }) {
  const tonos = {
    exito: 'text-success-600',
    peligro: 'text-danger-600',
    alerta: 'text-warning-600',
    tenue: 'text-muted-400',
  } as const;
  return (
    <span className={`tabular whitespace-nowrap ${tono ? tonos[tono] : ''} ${className}`}>
      {formatearCOP(valor)}
    </span>
  );
}

/** Cifra compacta para tarjetas de indicador: "$ 810 M". */
export function montoCompacto(valor: string | number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
    notation: 'compact',
  }).format(Number(valor));
}

/* --- Tabla ---------------------------------------------------------------- */

export function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-fino overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children, alinear = 'left', className = '', ...resto
}: {
  children?: ReactNode;
  alinear?: 'left' | 'right' | 'center';
} & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`whitespace-nowrap border-b border-muted-200 bg-muted-50 px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider text-muted-500 text-${alinear} ${className}`}
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
      className={`border-b border-muted-200/60 px-3 py-3 align-middle text-${alinear} ${className}`}
      {...resto}
    >
      {children}
    </td>
  );
}

/** Fila con realce al pasar el cursor; la ultima sin borde inferior. */
export function Fila({
  children, className = '', ...resto
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`transicion-suave last:[&>td]:border-b-0 hover:bg-brand-50/40 ${className}`}
      {...resto}
    >
      {children}
    </tr>
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
    <div className="px-6 py-16 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted-100 text-muted-400">
        <IconoVacio className="size-5" />
      </span>
      <p className="mt-4 text-sm font-medium text-ink-900">{titulo}</p>
      {descripcion && (
        <p className="mx-auto mt-1.5 max-w-sm text-pretty text-sm leading-relaxed text-muted-500">
          {descripcion}
        </p>
      )}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}

export function Aviso({
  tono = 'alerta', titulo, children,
}: { tono?: Tono; titulo?: string; children: ReactNode }) {
  const estilos: Record<Tono, string> = {
    neutro: 'bg-muted-50 text-muted-700 ring-muted-200',
    marca: 'bg-brand-50 text-brand-900 ring-brand-100',
    exito: 'bg-success-50 text-success-800 ring-success-100',
    alerta: 'bg-warning-50 text-warning-800 ring-warning-100',
    peligro: 'bg-danger-50 text-danger-800 ring-danger-100',
  };
  return (
    <div className={`rounded-[--radius-control] px-4 py-3 text-sm ring-1 ring-inset ${estilos[tono]}`}>
      {titulo && <p className="font-semibold">{titulo}</p>}
      <div className={titulo ? 'mt-0.5 leading-relaxed' : 'leading-relaxed'}>{children}</div>
    </div>
  );
}

/* --- Barra de progreso ----------------------------------------------------- */

export function Progreso({
  porcentaje, tono = 'marca', className = '',
}: { porcentaje: number; tono?: Tono; className?: string }) {
  const colores: Record<Tono, string> = {
    neutro: 'bg-muted-400',
    marca: 'bg-brand-500',
    exito: 'bg-success-500',
    alerta: 'bg-warning-500',
    peligro: 'bg-danger-500',
  };
  const ancho = Math.min(100, Math.max(0, porcentaje));
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-muted-200 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(ancho)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${colores[tono]}`}
        style={{ width: `${ancho}%` }}
      />
    </div>
  );
}

/* --- Celdas compuestas ----------------------------------------------------- */

/** Dato principal con su contexto debajo, patron repetido en las tablas. */
export function CeldaDoble({
  principal, secundario, mono = false,
}: { principal: ReactNode; secundario?: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <span
        className={`block truncate font-medium text-ink-900 ${mono ? 'font-mono text-xs' : ''}`}
      >
        {principal}
      </span>
      {secundario && (
        <span className="mt-0.5 block max-w-[11rem] truncate text-2xs text-muted-400">
          {secundario}
        </span>
      )}
    </div>
  );
}
