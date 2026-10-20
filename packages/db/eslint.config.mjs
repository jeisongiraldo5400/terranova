import config from '@terranova/config/eslint/base';

export default [
  ...config,
  {
    // El seed y los scripts de datos informan del avance por consola: es
    // su interfaz, no un rastro de depuracion olvidado.
    files: ['prisma/seed.ts', 'prisma/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
];
