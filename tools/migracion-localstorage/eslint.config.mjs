import config from '@terranova/config/eslint/base';

export default [
  ...config,
  {
    // El importador es una herramienta de linea de comandos: su salida
    // por consola es el informe que lee quien ejecuta la migracion.
    files: ['src/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
];
