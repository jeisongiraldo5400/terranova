// @ts-check
import tseslint from 'typescript-eslint';
import { base } from './base.mjs';

/** NestJS: decoradores y parametros de constructor inyectados. */
export default tseslint.config(...base, {
  files: ['**/*.ts'],
  rules: {
    // Los DTO llegan tipados como `never` desde el pipe de Zod: el tipo
    // real lo impone el esquema, no la firma del controlador.
    '@typescript-eslint/no-explicit-any': 'off',

    // Los servicios usan `private readonly` en el constructor; marcarlos
    // como no usados seria un falso positivo.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
    ],

    // El arranque y el seed informan por consola a proposito.
    'no-console': 'off',

    // Falso positivo con decoradores de parametro: un esquema usado solo
    // dentro de @Body(zodPipe(x)) se reporta como asignacion sin leer,
    // porque la regla no inspecciona los argumentos del decorador.
    'no-useless-assignment': 'off',
  },
});
