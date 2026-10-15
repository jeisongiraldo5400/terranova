import { exigirSesion } from '@/lib/sesion';
import { Sidebar } from '@/components/sidebar';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirSesion();

  return (
    <div className="flex min-h-dvh bg-surface">
      <Sidebar usuario={usuario} />
      <main className="min-w-0 flex-1 px-4 py-6 pt-16 lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
