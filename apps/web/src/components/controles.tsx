'use client';

import type {
  ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes,
} from 'react';

/* --- Boton --------------------------------------------------------------- */

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma' | 'sutil';

const VARIANTES: Record<Variante, string> = {
  primario:
    'bg-brand-600 text-white shadow-[--shadow-brand] hover:bg-brand-700 active:bg-brand-800',
  secundario:
    'bg-white text-ink-700 ring-1 ring-inset ring-muted-200 shadow-[--shadow-card] ' +
    'hover:bg-muted-50 hover:ring-muted-300 active:bg-muted-100',
  peligro: 'bg-danger-600 text-white shadow-[--shadow-card] hover:bg-danger-800',
  fantasma: 'text-brand-700 hover:bg-brand-50 active:bg-brand-100',
  sutil: 'bg-muted-100 text-ink-700 hover:bg-muted-200',
};

const TAMANOS = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
} as const;

export function Boton({
  children, variante = 'primario', tamano = 'md', cargando = false,
  iconoIzq, className = '', ...resto
}: {
  children?: ReactNode;
  variante?: Variante;
  tamano?: keyof typeof TAMANOS;
  cargando?: boolean;
  iconoIzq?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={
        'transicion-suave inline-flex shrink-0 items-center justify-center rounded-[--radius-control] ' +
        'font-medium disabled:pointer-events-none disabled:opacity-50 ' +
        `${TAMANOS[tamano]} ${VARIANTES[variante]} ${className}`
      }
      disabled={cargando || resto.disabled}
      {...resto}
    >
      {cargando ? (
        <span
          className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        iconoIzq
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
  etiqueta, error, ayuda, requerido, htmlFor, children,
}: {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  requerido?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink-800"
      >
        {etiqueta}
        {requerido && (
          <span className="text-danger-600" aria-label="obligatorio">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1 text-xs text-danger-600">
          <svg viewBox="0 0 24 24" className="mt-px size-3.5 shrink-0" fill="none"
               stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5M12 16h.01" />
          </svg>
          {error}
        </p>
      ) : ayuda ? (
        <p className="mt-1.5 text-xs text-muted-500">{ayuda}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  'transicion-suave w-full rounded-[--radius-control] border-0 bg-white text-sm text-ink-900 ' +
  'ring-1 ring-inset ring-muted-200 placeholder:text-muted-400 ' +
  'hover:ring-muted-300 focus:ring-2 focus:ring-inset focus:ring-brand-600 ' +
  'disabled:cursor-not-allowed disabled:bg-muted-100 disabled:text-muted-500';

export function Entrada({
  error, icono, className = '', ...resto
}: { error?: boolean; icono?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const campo = (
    <input
      className={`${CONTROL} h-10 ${icono ? 'pl-10 pr-3' : 'px-3'} ${
        error ? 'ring-danger-500 focus:ring-danger-600' : ''
      } ${className}`}
      aria-invalid={error || undefined}
      {...resto}
    />
  );

  if (!icono) return campo;

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-400">
        {icono}
      </span>
      {campo}
    </div>
  );
}

export function Seleccion({
  error, className = '', children, ...resto
}: { error?: boolean } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={`${CONTROL} h-10 cursor-pointer appearance-none py-0 pl-3 pr-9 ${
          error ? 'ring-danger-500' : ''
        } ${className}`}
        aria-invalid={error || undefined}
        {...resto}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-400"
        fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

export function AreaTexto({
  error, className = '', ...resto
}: { error?: boolean } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={`${CONTROL} px-3 py-2.5 leading-relaxed ${error ? 'ring-danger-500' : ''} ${className}`}
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
  error, className = '', ...resto
}: { error?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-400">
        $
      </span>
      <input
        inputMode="decimal"
        placeholder="0"
        className={`${CONTROL} tabular h-10 pl-7 pr-3 text-right font-medium ${
          error ? 'ring-danger-500' : ''
        } ${className}`}
        aria-invalid={error || undefined}
        {...resto}
      />
    </div>
  );
}
