import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TERRANOVA · Administración de lotes',
  description: 'Sistema de administración de proyectos, lotes, ventas y cartera',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
