import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

/**
 * Inter con `variable`: la fuente se expone como custom property y los
 * tokens de Tailwind la consumen. Con `display: swap` el texto se ve desde
 * el primer pintado en lugar de parpadear en blanco.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--fuente-inter',
  display: 'swap',
});

/** Monoespaciada solo para códigos de lote, documentos y huellas sha256. */
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--fuente-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: {
    default: 'TERRANOVA · Administración de lotes',
    template: '%s · TERRANOVA',
  },
  description: 'Administración de proyectos, lotes, ventas, cartera y contratos',
};

export const viewport: Viewport = {
  themeColor: '#1e3a8a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
