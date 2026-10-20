'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ETIQUETA_ROL } from '@terranova/shared';
import { api } from '@/lib/api';
import type { UsuarioSesion } from '@/lib/tipos';
import {
  IconoAuditoria, IconoCerrar, IconoClientes, IconoConfiguracion, IconoContratos, IconoLotes,
  IconoMenu, IconoPagos, IconoProyectos, IconoReportes, IconoSalir, IconoTablero,
  IconoVentas, Logo,
} from './iconos';

/**
 * Navegacion con rutas reales. El v0 usaba switch(pagina) sobre un useState
 * (App.jsx:50): no habia enlaces compartibles, el boton atras del navegador
 * no funcionaba y react-router estaba instalado sin usarse.
 */
const GRUPOS = [
  {
    titulo: null,
    modulos: [{ clave: 'dashboard', href: '/', etiqueta: 'Tablero', Icono: IconoTablero }],
  },
  {
    titulo: 'Inventario',
    modulos: [
      { clave: 'proyectos', href: '/proyectos', etiqueta: 'Proyectos', Icono: IconoProyectos },
      { clave: 'lotes', href: '/lotes', etiqueta: 'Lotes', Icono: IconoLotes },
      { clave: 'clientes', href: '/clientes', etiqueta: 'Clientes', Icono: IconoClientes },
    ],
  },
  {
    titulo: 'Comercial',
    modulos: [
      { clave: 'ventas', href: '/ventas', etiqueta: 'Ventas', Icono: IconoVentas },
      { clave: 'pagos', href: '/pagos', etiqueta: 'Pagos', Icono: IconoPagos },
      { clave: 'contratos', href: '/contratos', etiqueta: 'Contratos', Icono: IconoContratos },
    ],
  },
  {
    titulo: 'Sistema',
    modulos: [
      { clave: 'reportes', href: '/reportes', etiqueta: 'Reportes', Icono: IconoReportes },
      { clave: 'auditoria', href: '/auditoria', etiqueta: 'Auditoría', Icono: IconoAuditoria },
      { clave: 'configuracion', href: '/configuracion', etiqueta: 'Configuración', Icono: IconoConfiguracion },
    ],
  },
] as const;

export function Sidebar({ usuario }: { usuario: UsuarioSesion }) {
  const ruta = usePathname();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  const [abierto, setAbierto] = useState(false);

  // Al navegar en movil, el panel se cierra solo.
  useEffect(() => setAbierto(false), [ruta]);

  async function salir() {
    setSaliendo(true);
    await api.post('/auth/logout').catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  const esActivo = (href: string) => (href === '/' ? ruta === '/' : ruta.startsWith(href));
  const iniciales = usuario.nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <>
      {/* Barra superior solo en movil */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-muted-200 bg-surface-raised/85 px-4 backdrop-blur lg:hidden">
        <button
          onClick={() => setAbierto(true)}
          className="transicion-suave grid size-9 place-items-center rounded-[--radius-control] text-ink-700 hover:bg-muted-100"
          aria-label="Abrir menú"
        >
          <IconoMenu className="size-5" />
        </button>
        <Logo className="size-7" />
        <span className="font-semibold tracking-tight text-ink-900">TERRANOVA</span>
      </div>

      {abierto && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setAbierto(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-brand-950 transition-transform duration-200 lg:static lg:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* --- Marca --- */}
        <div className="flex h-16 items-center gap-3 px-5">
          <Logo className="size-9" sobreOscuro />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-white">TERRANOVA</p>
            <p className="truncate text-2xs text-brand-300/70">Administración de lotes</p>
          </div>
          <button
            onClick={() => setAbierto(false)}
            className="grid size-8 place-items-center rounded-md text-brand-300 hover:bg-white/10 lg:hidden"
            aria-label="Cerrar menú"
          >
            <IconoCerrar className="size-4" />
          </button>
        </div>

        {/* --- Modulos --- */}
        <nav className="scroll-fino flex-1 overflow-y-auto px-3 py-2" aria-label="Módulos">
          {GRUPOS.map((grupo) => {
            const visibles = grupo.modulos.filter((m) => usuario.modulos.includes(m.clave));
            if (visibles.length === 0) return null;

            return (
              <div key={grupo.titulo ?? 'principal'} className="mb-5">
                {grupo.titulo && (
                  <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-wider text-brand-400/60">
                    {grupo.titulo}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {visibles.map(({ clave, href, etiqueta, Icono }) => {
                    const activo = esActivo(href);
                    return (
                      <li key={clave}>
                        <Link
                          href={href}
                          aria-current={activo ? 'page' : undefined}
                          className={`transicion-suave group relative flex items-center gap-3 rounded-[--radius-control] px-3 py-2 text-sm ${
                            activo
                              ? 'bg-brand-600/90 font-medium text-white shadow-[--shadow-card]'
                              : 'text-brand-100/65 hover:bg-white/[0.07] hover:text-white'
                          }`}
                        >
                          <Icono
                            className={`size-[18px] shrink-0 transition-opacity ${
                              activo ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                            }`}
                          />
                          {etiqueta}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* --- Usuario --- */}
        <div className="border-t border-white/[0.08] p-3">
          <div className="flex items-center gap-3 rounded-[--radius-control] px-2 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white ring-2 ring-brand-500/25">
              {iniciales}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{usuario.nombre}</p>
              <p className="truncate text-2xs text-brand-300/70">{ETIQUETA_ROL[usuario.rol]}</p>
            </div>
          </div>

          <button
            onClick={salir}
            disabled={saliendo}
            className="transicion-suave mt-1 flex w-full items-center gap-3 rounded-[--radius-control] px-3 py-2 text-sm text-brand-100/60 hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
          >
            <IconoSalir className="size-[18px] shrink-0" />
            {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
    </>
  );
}
