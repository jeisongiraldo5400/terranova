'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

/* --- Boton --------------------------------------------------------------- */

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600',
  secundario: 'bg-white text-ink-700 ring-1 ring-inset ring-muted-300 hover:bg-muted-100',
  peligro: 'bg-danger-600 text-white hover:bg-danger-800',
  fantasma: 'text-brand-600 hover:bg-brand-50',
};

export function Boton({
  children, variante = 'primario', cargando = false, className = '', ...resto
}: {
  children: ReactNode;
  variante?: Variante;
  cargando?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-[--radius-control] px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
      disabled={cargando || resto.disabled}
      {...resto}
    >
      {cargando && (
        <span
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}

/* --- Campos -------------------------------------------------------------- */

/**
 * El error se muestra junto al campo que lo produjo, no en un alert()
 * global. Los mensajes vienen del mismo esquema Zod que valida el servidor,
 * con la forma { campo: mensaje }.
 */
export function Campo({
  etiqueta, error, ayuda, requerido, children,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  requerido?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-700">
        {etiqueta}
        {requerido && <span className="ml-0.5 text-danger-600">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger-600">{error}</span>
      ) : ayuda ? (
        <span className="mt-1 block text-xs text-muted-500">{ayuda}</span>
      ) : null}
    </label>
  );
}

const CLASE_CONTROL =
  'w-full rounded-[--radius-control] border-0 bg-white px-3 py-2 text-sm text-ink-900 ' +
  'ring-1 ring-inset ring-muted-300 placeholder:text-muted-400 ' +
  'focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:bg-muted-100';

export function Entrada({
  error, className = '', ...resto
}: { error?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`${CLASE_CONTROL} ${error ? 'ring-danger-600' : ''} ${className}`}
      aria-invalid={error || undefined}
      {...resto}
    />
  );
}

export function Seleccion({
  error, className = '', children, ...resto
}: { error?: boolean } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${CLASE_CONTROL} ${error ? 'ring-danger-600' : ''} ${className}`}
      aria-invalid={error || undefined}
      {...resto}
    >
      {children}
    </select>
  );
}

export function AreaTexto({
  error, className = '', ...resto
}: { error?: boolean } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={`${CLASE_CONTROL} ${error ? 'ring-danger-600' : ''} ${className}`}
      aria-invalid={error || undefined}
      {...resto}
    />
  );
}

/**
 * Campo de dinero. Guarda el texto tal como lo escribe la persona
 * ("120.000.000") y el servidor lo interpreta con dineroDesdeTexto. No se
 * convierte a number en ningun punto del camino.
 */
export function EntradaDinero({
  error, ...resto
}: { error?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-500">
        $
      </span>
      <Entrada
        inputMode="decimal"
        placeholder="0"
        error={error}
        className="tabular pl-7 text-right"
        {...resto}
      />
    </div>
  );
}
