'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { Boton } from './controles';

/**
 * Paginación. La API ya la soportaba (`pagina`, `porPagina`); faltaba el
 * control en pantalla, así que los listados traían 50 filas fijas y lo
 * demás quedaba invisible.
 *
 * La página viaja en la URL para que el enlace sea compartible y el botón
 * atrás del navegador funcione.
 */
export function Paginacion({
  pagina, totalPaginas, total, ruta,
}: { pagina: number; totalPaginas: number; total: number; ruta: Route }) {
  const router = useRouter();
  const params = useSearchParams();

  if (totalPaginas <= 1) return null;

  function ir(destino: number) {
    const p = new URLSearchParams(params.toString());
    if (destino <= 1) p.delete('pagina');
    else p.set('pagina', String(destino));
    const qs = p.toString();
    router.replace((qs ? `${ruta}?${qs}` : ruta) as Route);
  }

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-muted-200/70 px-5 py-3"
      aria-label="Paginación"
    >
      <p className="text-xs text-muted-500">
        Página <span className="tabular font-medium text-ink-800">{pagina}</span> de{' '}
        <span className="tabular font-medium text-ink-800">{totalPaginas}</span>
        <span className="mx-1.5 text-muted-300">·</span>
        <span className="tabular">{total}</span> registro(s)
      </p>

      <div className="flex gap-2">
        <Boton
          variante="secundario"
          tamano="sm"
          onClick={() => ir(pagina - 1)}
          disabled={pagina <= 1}
        >
          Anterior
        </Boton>
        <Boton
          variante="secundario"
          tamano="sm"
          onClick={() => ir(pagina + 1)}
          disabled={pagina >= totalPaginas}
        >
          Siguiente
        </Boton>
      </div>
    </nav>
  );
}
