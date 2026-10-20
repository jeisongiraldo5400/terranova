import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // El paquete compartido se compila a CommonJS; Next lo transpila para
  // poder usarlo desde componentes de servidor y de cliente por igual.
  transpilePackages: ['@terranova/shared'],
  // typedRoutes dejo de ser experimental en Next 16.
  typedRoutes: true,
  // Servidor autocontenido para la imagen de Docker: Next copia solo los
  // modulos que realmente usa, en lugar de arrastrar node_modules entero.
  output: 'standalone',
};

export default config;
