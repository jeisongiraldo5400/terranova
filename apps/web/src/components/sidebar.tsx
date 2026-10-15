'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { UsuarioSesion } from '@/lib/tipos';
import { ETIQUETA_ROL } from '@terranova/shared';

/**
 * Navegacion con rutas reales. El v0 usaba switch(pagina) sobre un useState
 * (App.jsx:50), de modo que no habia enlaces compartibles, el boton atras
 * del navegador no funcionaba y react-router estaba instalado sin usarse.
 */
const MODULOS = [
  { clave: 'dashboard', href: '/', etiqueta: 'Tablero', icono: '◱' },
  { clave: 'proyectos', href: '/proyectos', etiqueta: 'Proyectos', icono: '◫' },
  { clave: 'lotes', href: '/lotes', etiqueta: 'Lotes', icono: '▦' },
  { clave: 'clientes', href: '/clientes', etiqueta: 'Clientes', icono: '◐' },
  { clave: 'ventas', href: '/ventas', etiqueta: 'Ventas', icono: '◈' },
  { clave: 'pagos', href: '/pagos', etiqueta: 'Pagos', icono: '◉' },
  { clave: 'contratos', href: '/contratos', etiqueta: 'Contratos', icono: '▤' },
  { clave: 'reportes', href: '/reportes', etiqueta: 'Reportes', icono: '◲' },
  { clave: 'configuracion', href: '/configuracion', etiqueta: 'Configuración', icono: '⚙' },
] as const;

export function Sidebar({ usuario }: { usuario: UsuarioSesion }) {
  const ruta = usePathname();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  const [abierto, setAbierto] = useState(false);

  // El menu se deriva del rol con la misma matriz que autoriza la API.
  const visibles = MODULOS.filter((m) => usuario.modulos.includes(m.clave));

  async function salir() {
    setSaliendo(true);
    await api.post('/auth/logout').catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="fixed left-3 top-3 z-50 rounded-[--radius-control] bg-brand-900 px-3 py-2 text-sm text-white lg:hidden"
        aria-expanded={abierto}
        aria-controls="menu-lateral"
      >
        ☰ Menú
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-30 bg-ink-900/50 lg:hidden"
          onClick={() => setAbierto(false)}
          aria-hidden
        />
      )}

      <aside
        id="menu-lateral"
        className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col bg-brand-900 text-white transition-transform lg:static lg:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-lg font-semibold tracking-tight">TERRANOVA</p>
          <p className="mt-0.5 text-xs text-brand-100/70">Administración de lotes</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3" aria-label="Módulos">
          <ul className="space-y-0.5">
            {visibles.map((m) => {
              const activo = m.href === '/' ? ruta === '/' : ruta.startsWith(m.href);
              return (
                <li key={m.clave}>
                  <Link
                    href={m.href}
                    onClick={() => setAbierto(false)}
                    aria-current={activo ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-[--radius-control] px-3 py-2 text-sm transition-colors ${
                      activo
                        ? 'bg-brand-600 font-medium text-white'
                        : 'text-brand-100/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span aria-hidden className="w-4 text-center opacity-80">
                      {m.icono}
                    </span>
                    {m.etiqueta}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-medium">{usuario.nombre}</p>
            <p className="text-xs text-brand-100/70">{ETIQUETA_ROL[usuario.rol]}</p>
          </div>
          <button
            onClick={salir}
            disabled={saliendo}
            className="mt-1 w-full rounded-[--radius-control] px-3 py-2 text-left text-sm text-brand-100/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
    </>
  );
}
