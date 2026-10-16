import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Route } from 'next';
import { IconoAtras } from './iconos';

export function EncabezadoPagina({
  titulo, descripcion, acciones, volver,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  volver?: { href: Route; etiqueta: string };
}) {
  return (
    <header className="mb-6">
      {volver && (
        <Link
          href={volver.href}
          className="transicion-suave mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-500 hover:text-brand-700"
        >
          <IconoAtras className="size-4" />
          {volver.etiqueta}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-ink-900">
            {titulo}
          </h1>
          {descripcion && (
            <p className="mt-1.5 max-w-2xl text-pretty text-sm leading-relaxed text-muted-500">
              {descripcion}
            </p>
          )}
        </div>
        {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
      </div>
    </header>
  );
}
