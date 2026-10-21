/* ==========================================================================
   Preparacion de la base de pruebas
   --------------------------------------------------------------------------
   Se corre contra PostgreSQL de verdad, no contra un doble. Las invariantes
   mas importantes del sistema -- el indice unico parcial que impide la
   doble venta, los triggers de area y de sobrepago -- viven en la base:
   probarlas contra un mock no probaria nada.

   SEGURIDAD: estas pruebas CREAN Y DESTRUYEN una base en cada ejecucion.
   Por eso no usan DATABASE_URL, que en desarrollo puede apuntar a un
   servidor gestionado compartido con otros proyectos. Usan su propia
   variable y, ademas, se niegan a ejecutarse si el destino no es local.
   ========================================================================== */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { config as cargarEnv } from 'dotenv';
import pg from 'pg';

const RAIZ = resolve(import.meta.dirname, '../../..');
const BASE_PRUEBAS = 'terranova_test';

/** Solo se admite un PostgreSQL en esta maquina. */
const ANFITRIONES_PERMITIDOS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

const POR_DEFECTO =
  'postgresql://terranova:terranova_local@localhost:5432/postgres';

export async function setup(): Promise<void> {
  cargarEnv({ path: resolve(RAIZ, '.env'), quiet: true });

  // TEST_DATABASE_URL, no DATABASE_URL: esta ultima puede apuntar a
  // produccion y aqui se hace DROP DATABASE.
  const crudo = process.env.TEST_DATABASE_URL ?? POR_DEFECTO;
  const url = new URL(crudo);

  if (!ANFITRIONES_PERMITIDOS.has(url.hostname)) {
    throw new Error(
      `Las pruebas de integracion crean y destruyen la base "${BASE_PRUEBAS}" y solo ` +
        `pueden correr contra un PostgreSQL local.\n` +
        `  Destino recibido : ${url.hostname}\n` +
        `  Permitidos       : ${[...ANFITRIONES_PERMITIDOS].join(', ')}\n\n` +
        `Levante la base local con "pnpm up" o defina TEST_DATABASE_URL.`,
    );
  }

  const admin = new pg.Client({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: 'postgres',
    connectionTimeoutMillis: 10_000,
  });

  try {
    await admin.connect();
  } catch (e) {
    throw new Error(
      `No se pudo conectar al PostgreSQL local en ${url.hostname}:${url.port || 5432}.\n` +
        `Levantelo con "pnpm up" antes de correr las pruebas de integracion.`,
      { cause: e },
    );
  }

  // Recrear desde cero: cada ejecucion parte de un estado conocido.
  await admin.query(`DROP DATABASE IF EXISTS ${BASE_PRUEBAS} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${BASE_PRUEBAS}`);
  await admin.end();

  const destino = new URL(crudo);
  destino.pathname = `/${BASE_PRUEBAS}`;
  destino.search = '';
  process.env.DATABASE_URL = destino.toString();

  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(RAIZ, 'packages/db'),
    env: { ...process.env, DATABASE_URL: destino.toString() },
    stdio: 'pipe',
  });
}

export async function teardown(): Promise<void> {
  // La base se deja en pie a proposito: si una prueba falla, poder
  // inspeccionar el estado resultante vale mas que la limpieza.
}
