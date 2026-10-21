#!/usr/bin/env tsx
/* ==========================================================================
   Arranque de una instalacion nueva
   --------------------------------------------------------------------------
   Deja la base utilizable SIN datos de demostracion: crea el usuario
   administrador y, si falta, la configuracion de la empresa.

   A diferencia de `seed`, no borra nada: se puede ejecutar sobre una base
   con informacion real sin riesgo.

     pnpm db:arranque                       (clave generada y mostrada)
     pnpm db:arranque -- --email a@b.co     (correo propio)
   ========================================================================== */

import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import * as argon2 from 'argon2';
import { PrismaClient } from '../generated/client/index.js';

const { values } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: 'string' },
    nombre: { type: 'string' },
    password: { type: 'string' },
  },
});

const prisma = new PrismaClient();

/** Clave legible pero fuerte: 4 bloques de 5 caracteres. */
function claveGenerada(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(20);
  const cuerpo = [...bytes].map((b) => abc[b % abc.length]).join('');
  return (
    `${cuerpo.slice(0, 5)}-${cuerpo.slice(5, 10)}-${cuerpo.slice(10, 15)}-${cuerpo.slice(15, 20)}`
  );
}

async function main(): Promise<void> {
  const email = (values.email ?? process.env.SEED_ADMIN_EMAIL ?? 'admin@terranova.co').toLowerCase();
  const nombre = values.nombre ?? 'Administrador';
  const generada = !values.password;
  const clave = values.password ?? claveGenerada();

  const existente = await prisma.usuario.findUnique({ where: { email } });

  if (existente) {
    console.log(`\nEl usuario ${email} ya existe; no se modifica.`);
    console.log('Para cambiarle la clave use Configuración → Usuarios, o:');
    console.log(`  pnpm db:arranque --email otro@correo.co\n`);
  } else {
    await prisma.usuario.create({
      data: {
        email,
        nombre,
        rol: 'ADMIN',
        passwordHash: await argon2.hash(clave, {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        }),
      },
    });

    console.log('\n  Administrador creado');
    console.log(`     correo : ${email}`);
    console.log(`     clave  : ${clave}`);
    if (generada) {
      console.log('\n  Esta clave se muestra UNA sola vez y no queda guardada en');
      console.log('  ningun archivo. Anotela ahora y cambiela tras el primer ingreso.');
    }
  }

  // Sin estos datos no se pueden emitir contratos; se crean como plantilla
  // para que el sistema arranque, y se completan desde Configuracion.
  const config = await prisma.configuracionEmpresa.findUnique({ where: { id: 1 } });
  if (!config) {
    await prisma.configuracionEmpresa.create({
      data: {
        id: 1,
        razonSocial: 'Urbanización Terranova S.A.S.',
        nit: '0000000000',
        direccion: 'Pendiente por completar',
        ciudad: 'Montería',
        telefono: '0000000',
        email,
        representanteLegal: 'Pendiente por completar',
        documentoRepresentante: '0000000000',
      },
    });
    console.log('\n  Configuración de empresa creada como plantilla.');
    console.log('  Complétela en Configuración antes de emitir contratos.');
  }

  const totales = {
    usuarios: await prisma.usuario.count(),
    proyectos: await prisma.proyecto.count(),
    lotes: await prisma.lote.count(),
    clientes: await prisma.cliente.count(),
    ventas: await prisma.venta.count(),
  };
  console.log('\n  Estado de la base:', JSON.stringify(totales));
  console.log();
}

main()
  .catch((e: unknown) => {
    console.error('\nFalló el arranque:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
