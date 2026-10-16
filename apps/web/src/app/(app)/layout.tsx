import { exigirSesion } from '@/lib/sesion';
import { Sidebar } from '@/components/sidebar';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirSesion();

  return (
    <div className="flex min-h-dvh flex-col bg-surface lg:flex-row">
      <Sidebar usuario={usuario} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[88rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
