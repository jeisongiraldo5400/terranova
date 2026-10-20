'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Seleccion } from '@/components/controles';
import { conQuery } from '@/lib/rutas';
import type { ProyectoResumen } from '@/lib/tipos';

/**
 * Filtro por proyecto. La API ya aceptaba `proyectoId` en todos los
 * reportes; faltaba el control, de modo que la página pedía la lista de
 * proyectos y no hacía nada con ella.
 */
export function FiltroProyecto({
  proyectos, valor,
}: { proyectos: ProyectoResumen[]; valor?: string }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <Seleccion
      value={valor ?? ''}
      onChange={(e) => {
        const p = new URLSearchParams(params.toString());
        if (e.target.value) p.set('proyectoId', e.target.value);
        else p.delete('proyectoId');
        router.replace(conQuery('/reportes', Object.fromEntries(p)));
      }}
      aria-label="Filtrar por proyecto"
      className="max-w-xs"
    >
      <option value="">Todos los proyectos</option>
      {proyectos.map((p) => (
        <option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</option>
      ))}
    </Seleccion>
  );
}

/** Pestañas del reporte visible. Van en la URL para poder compartirlas. */
export function PestanasReporte({ activa, qs }: { activa: string; qs: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const pestanas = [
    { clave: 'cartera', etiqueta: 'Cartera' },
    { clave: 'recaudo', etiqueta: 'Recaudo' },
    { clave: 'inventario', etiqueta: 'Inventario' },
  ];

  return (
    <div
      className="flex gap-1 rounded-[--radius-control] bg-muted-100 p-1"
      role="tablist"
      aria-label="Reporte"
    >
      {pestanas.map((p) => {
        const sel = activa === p.clave;
        return (
          <button
            key={p.clave}
            role="tab"
            aria-selected={sel}
            onClick={() => {
              const q = new URLSearchParams(params.toString());
              if (p.clave === 'cartera') q.delete('ver');
              else q.set('ver', p.clave);
              router.replace(conQuery('/reportes', Object.fromEntries(q)));
            }}
            className={`transicion-suave rounded-md px-3.5 py-1.5 text-sm font-medium ${
              sel
                ? 'bg-white text-ink-900 shadow-[--shadow-card]'
                : 'text-muted-600 hover:text-ink-900'
            }`}
          >
            {p.etiqueta}
          </button>
        );
      })}
      <span className="sr-only">{qs}</span>
    </div>
  );
}
