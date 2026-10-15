'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { EstadoLote, ETIQUETA_ESTADO_LOTE } from '@terranova/shared';
import type { ProyectoResumen } from '@/lib/tipos';
import { Entrada, Seleccion } from '@/components/controles';
import { conQuery } from '@/lib/rutas';

/**
 * Los filtros viven en la URL, no en useState: el enlace se puede
 * compartir, el boton atras funciona y recargar no pierde la busqueda.
 */
export function FiltrosLotes({
  proyectos, valores,
}: { proyectos: ProyectoResumen[]; valores: Record<string, string | undefined> }) {
  const router = useRouter();
  const params = useSearchParams();

  function actualizar(clave: string, valor: string) {
    const p = new URLSearchParams(params.toString());
    if (valor) p.set(clave, valor);
    else p.delete(clave);
    p.delete('pagina');
    router.replace(conQuery('/lotes', Object.fromEntries(p)));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Entrada
        placeholder="Buscar por código…"
        defaultValue={valores.buscar ?? ''}
        onChange={(e) => actualizar('buscar', e.target.value)}
        aria-label="Buscar lote por código"
      />
      <Seleccion
        defaultValue={valores.proyectoId ?? ''}
        onChange={(e) => actualizar('proyectoId', e.target.value)}
        aria-label="Filtrar por proyecto"
      >
        <option value="">Todos los proyectos</option>
        {proyectos.map((p) => (
          <option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</option>
        ))}
      </Seleccion>
      <Seleccion
        defaultValue={valores.estado ?? ''}
        onChange={(e) => actualizar('estado', e.target.value)}
        aria-label="Filtrar por estado"
      >
        <option value="">Todos los estados</option>
        {Object.values(EstadoLote).map((e) => (
          <option key={e} value={e}>{ETIQUETA_ESTADO_LOTE[e]}</option>
        ))}
      </Seleccion>
    </div>
  );
}
