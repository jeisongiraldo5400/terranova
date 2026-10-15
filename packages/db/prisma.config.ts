import path from 'node:path';
import { config as cargarEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

/**
 * Configuracion de Prisma. Reemplaza la clave `prisma` del package.json,
 * deprecada y que desaparece en Prisma 7.
 *
 * Al existir este archivo, Prisma deja de cargar el .env por su cuenta, de
 * modo que hay que hacerlo de forma explicita. El .env vive en la raiz del
 * monorepo para que la API, el frontend y las migraciones compartan una
 * sola fuente de configuracion.
 */
cargarEnv({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
