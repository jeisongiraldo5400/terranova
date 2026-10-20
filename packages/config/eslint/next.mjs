// @ts-check
import tseslint from 'typescript-eslint';
import { base } from './base.mjs';

/** Next.js con React 19 y Server Components. */
export default tseslint.config(...base, {
  files: ['**/*.tsx', '**/*.ts'],
  rules: {
    // Los componentes de servidor reciben datos de la API ya validados;
    // tiparlos de nuevo duplicaria los esquemas de @terranova/shared.
    '@typescript-eslint/no-explicit-any': 'off',
  },
});
