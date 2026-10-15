import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Nest resuelve las dependencias leyendo los metadatos que TypeScript
  // emite con emitDecoratorMetadata. Vitest compila con esbuild, que no
  // los emite, y entonces cada parametro inyectado llega como undefined.
  // SWC si los emite.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.e2e.ts'],
    globalSetup: ['./test/preparar-base.ts'],
    // Las pruebas comparten una base real: en paralelo una veria los datos
    // de otra.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
