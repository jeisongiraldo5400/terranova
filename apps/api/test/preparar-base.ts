/* ==========================================================================
   Preparacion de la base de pruebas
   --------------------------------------------------------------------------
   Se corre contra PostgreSQL de verdad, no contra un doble. Las invariantes
   mas importantes del sistema -- el indice unico parcial que impide la doble
   venta, los triggers de area y de sobrepago -- viven en la base: probarlas
   contra un mock no probaria nada.

   Se usa una base aparte para no tocar los datos de desarrollo.
   ========================================================================== */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { config as cargarEnv } from 'dotenv';

const RAIZ = resolve(import.meta.dirname, '../../..');
const BASE_PRUEBAS = 'terranova_test';

export async function setup(): Promise<void> {
  cargarEnv({ path: resolve(RAIZ, '.env'), quiet: true });

  const original = process.env.DATABASE_URL;
  if (!original) throw new Error('Falta DATABASE_URL; revise el .env de la raiz.');

  const url = new URL(original);
  url.pathname = `/${BASE_PRUEBAS}`;

  // psql no entiende los parametros propios de Prisma (?schema=, ?options=),
  // asi que la cadena para administrar la base va sin query.
  const paraPsql = new URL(original);
  paraPsql.pathname = '/postgres';
  paraPsql.search = '';

  const psql = (sql: string) =>
    execSync(
      `docker exec terranova-postgres psql "${paraPsql.toString()}" -v ON_ERROR_STOP=1 -q -c ${JSON.stringify(sql)}`,
      { stdio: 'pipe' },
    );

  // Recrear desde cero: cada ejecucion parte de un estado conocido.
  psql(`DROP DATABASE IF EXISTS ${BASE_PRUEBAS} WITH (FORCE)`);
  psql(`CREATE DATABASE ${BASE_PRUEBAS}`);

  process.env.DATABASE_URL = url.toString();

  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(RAIZ, 'packages/db'),
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  });
}

export async function teardown(): Promise<void> {
  // La base se deja en pie a proposito: si una prueba falla, poder
  // inspeccionar el estado resultante vale mas que la limpieza.
}
