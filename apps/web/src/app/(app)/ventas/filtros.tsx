'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ETIQUETA_ESTADO_CARTERA } from '@terranova/shared';
import type { ProyectoResumen } from '@/lib/tipos';
import { Entrada, Seleccion } from '@/components/controles';
import { IconoBuscar } from '@/components/iconos';
import { conQuery } from '@/lib/rutas';

export function FiltrosVentas({
  proyectos, valores,
}: { proyectos: ProyectoResumen[]; valores: Record<string, string | undefined> }) {
  const router = useRouter();
  const params = useSearchParams();

  function actualizar(clave: string, valor: string) {
    const p = new URLSearchParams(params.toString());
    if (valor) p.set(clave, valor);
    else p.delete(clave);
    p.delete('pagina');
    router.replace(conQuery('/ventas', Object.fromEntries(p)));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Entrada
        placeholder="Buscar por cliente, cédula, lote o número…"
        defaultValue={valores.buscar ?? ''}
        onChange={(e) => actualizar('buscar', e.target.value)}
        aria-label="Buscar venta"
        icono={<IconoBuscar className="size-4" />}
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
        defaultValue={valores.estadoCartera ?? ''}
        onChange={(e) => actualizar('estadoCartera', e.target.value)}
        aria-label="Filtrar por estado de cartera"
      >
        <option value="">Toda la cartera</option>
        {(['PENDIENTE', 'PARCIAL', 'PAGADO', 'EN_MORA'] as const).map((e) => (
          <option key={e} value={e}>{ETIQUETA_ESTADO_CARTERA[e]}</option>
        ))}
      </Seleccion>
    </div>
  );
}
