import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // El paquete compartido se compila a CommonJS; Next lo transpila para
  // poder usarlo desde componentes de servidor y de cliente por igual.
  transpilePackages: ['@terranova/shared'],
  // typedRoutes dejo de ser experimental en Next 16.
  typedRoutes: true,
};

export default config;
