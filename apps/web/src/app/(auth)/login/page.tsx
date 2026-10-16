import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/sesion';
import { Logo } from '@/components/iconos';
import { FormularioLogin } from './formulario';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default async function PaginaLogin() {
  if (await sesionActual()) redirect('/');

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* ---------------------------------------------------------------
          Panel de marca. Solo desde lg: en móvil ocuparía la pantalla
          entera sin aportar nada a quien solo quiere entrar.
          --------------------------------------------------------------- */}
      <section className="malla-marca relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="reticula absolute inset-0" aria-hidden />

        <div className="relative flex items-center gap-3">
          <Logo className="size-11" />
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">TERRANOVA</p>
            <p className="text-xs text-brand-200/80">Administración de lotes</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight text-white">
            El estado de su cartera,
            <span className="block text-brand-300">siempre exacto.</span>
          </h1>
          <p className="mt-5 text-pretty leading-relaxed text-brand-100/70">
            Inventario, ventas, abonos y contratos en un solo lugar. El saldo se
            calcula a partir de los pagos registrados, de modo que lo que ve en
            pantalla es lo que dice la contabilidad.
          </p>

          <ul className="mt-10 space-y-3.5">
            {[
              'Cartera y mora al día, por proyecto y por cliente',
              'Contratos numerados y archivados automáticamente',
              'Cada movimiento de dinero queda registrado y es rastreable',
            ].map((punto) => (
              <li key={punto} className="flex items-start gap-3 text-sm text-brand-100/85">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-400/20 ring-1 ring-brand-300/30">
                  <svg viewBox="0 0 24 24" className="size-3 text-brand-200" fill="none"
                       stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6.5 9.5 17 4 11.5" />
                  </svg>
                </span>
                {punto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-200/50">
          © {new Date().getFullYear()} Urbanización Terranova S.A.S.
        </p>
      </section>

      {/* ---------------------------------------------------------------
          Formulario
          --------------------------------------------------------------- */}
      <section className="flex items-center justify-center bg-surface-raised px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          {/* La marca se repite aquí solo cuando el panel izquierdo no está. */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Logo className="size-10" />
            <div>
              <p className="font-semibold tracking-tight text-ink-900">TERRANOVA</p>
              <p className="text-xs text-muted-500">Administración de lotes</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
              Bienvenido de vuelta
            </h2>
            <p className="mt-1.5 text-sm text-muted-500">
              Ingrese sus credenciales para continuar.
            </p>
          </div>

          <FormularioLogin />

          <p className="mt-10 text-center text-xs leading-relaxed text-muted-400">
            ¿Olvidó su contraseña? Solicite el restablecimiento
            <br className="hidden sm:block" /> a un administrador del sistema.
          </p>
        </div>
      </section>
    </main>
  );
}
