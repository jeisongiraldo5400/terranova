// @ts-check
/* ==========================================================================
   Reglas comunes a todo el monorepo
   --------------------------------------------------------------------------
   El criterio: solo reglas que atrapen errores reales. Las de estilo las
   resuelve Prettier, y una lista larga de reglas cosmeticas acaba
   desactivandose en bloque, que es peor que no tenerlas.
   ========================================================================== */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export const ignorados = {
  ignores: [
    '**/dist/**',
    '**/.next/**',
    '**/generated/**',
    '**/node_modules/**',
    '**/.turbo/**',
    '**/coverage/**',
    'legacy/**',
  ],
};

export const base = tseslint.config(
  ignorados,
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Las variables sin usar casi siempre son un descuido; el prefijo _
      // declara que la omision es intencional.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // `any` se permite acotado, pero debe verse en la revision.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Promesas sin await: la causa habitual de que un error se pierda
      // en silencio o de que una transaccion se cierre antes de tiempo.
      'no-floating-decimal': 'error',
      'require-await': 'off',
      '@typescript-eslint/no-misused-promises': 'off',

      // El dinero del sistema es Decimal. `==` entre objetos compara
      // referencias y daria siempre falso.
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
);

export default base;
