import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/sesion';
import { FormularioLogin } from './formulario';

export default async function PaginaLogin() {
  if (await sesionActual()) redirect('/');

  return (
    <main className="grid min-h-dvh place-items-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">TERRANOVA</h1>
          <p className="mt-1 text-sm text-slate-400">Administración de lotes</p>
        </div>

        <div className="rounded-[--radius-card] bg-white p-6 shadow-[--shadow-overlay]">
          <FormularioLogin />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Urbanización Terranova
        </p>
      </div>
    </main>
  );
}
