import type { ReactNode } from 'react';

export function EncabezadoPagina({
  titulo, descripcion, acciones,
}: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-muted-600">{descripcion}</p>}
      </div>
      {acciones && <div className="flex gap-2">{acciones}</div>}
    </header>
  );
}
