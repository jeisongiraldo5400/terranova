import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/sesion';
import { Logo } from '@/components/iconos';
import { FormularioLogin } from './formulario';

export const metadata: Metadata = { title: 'Iniciar sesión' };

/* ==========================================================================
   Inicio de sesion
   --------------------------------------------------------------------------
   Sistema interno: quien llega aqui ya sabe que es y viene a entrar. Sin
   panel de marca ni argumentos de venta, que solo alargarian el camino.
   La pantalla es la marca, el formulario y nada mas.
   ========================================================================== */

export default async function PaginaLogin() {
  if (await sesionActual()) redirect('/');

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-12">
      <div className="w-full max-w-[25rem]">
        {/* --- Marca --- */}
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo className="size-12" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink-900">TERRANOVA</h1>
          <p className="mt-1 text-sm text-muted-500">Administración de lotes</p>
        </div>

        {/* --- Formulario --- */}
        <div className="rounded-[--radius-panel] bg-surface-raised p-7 shadow-[--shadow-raised] ring-1 ring-muted-200/70">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-ink-900">Iniciar sesión</h2>
            <p className="mt-0.5 text-sm text-muted-500">
              Ingrese sus credenciales para continuar.
            </p>
          </div>

          <FormularioLogin />
        </div>

        <p className="mt-7 text-center text-xs leading-relaxed text-muted-400">
          ¿Olvidó su contraseña? Solicite el restablecimiento a un administrador.
        </p>

        <p className="mt-6 text-center text-2xs text-muted-300">
          © {new Date().getFullYear()} Urbanización Terranova S.A.S.
        </p>
      </div>
    </main>
  );
}
