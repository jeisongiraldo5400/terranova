/* Utilidades compartidas por las pruebas e2e. */

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { Prisma } from '@terranova/db';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { DominioExceptionFilter } from '../src/common/filtros/dominio.filter.js';
import { SerializarInterceptor } from '../src/common/interceptores/serializar.interceptor.js';

export const dec = (v: string) => new Prisma.Decimal(v);
export const fecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export interface Contexto {
  app: INestApplication;
  prisma: PrismaService;
}

export async function arrancarApp(): Promise<Contexto> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = modulo.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new DominioExceptionFilter());
  app.useGlobalInterceptors(new SerializarInterceptor());
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

/** Deja la base vacia respetando las restricciones de integridad. */
export async function limpiar(prisma: PrismaService): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.contrato.deleteMany(),
    prisma.pago.deleteMany(),
    prisma.venta.deleteMany(), // cascada: planes y cuotas
    prisma.lote.deleteMany(),
    prisma.etapa.deleteMany(),
    prisma.proyecto.deleteMany(),
    prisma.cliente.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.usuario.deleteMany(),
    prisma.configuracionEmpresa.deleteMany(),
  ]);
}

const CLAVE = 'Prueba.2026';

export async function crearUsuarios(prisma: PrismaService) {
  const hash = await argon2.hash(CLAVE, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2 });
  const [admin, secretaria, empleado] = await Promise.all([
    prisma.usuario.create({ data: { email: 'admin@t.co', nombre: 'Admin', passwordHash: hash, rol: 'ADMIN' } }),
    prisma.usuario.create({ data: { email: 'sec@t.co', nombre: 'Secretaria', passwordHash: hash, rol: 'SECRETARIA' } }),
    prisma.usuario.create({ data: { email: 'emp@t.co', nombre: 'Empleado', passwordHash: hash, rol: 'EMPLEADO' } }),
  ]);
  return { admin, secretaria, empleado, clave: CLAVE };
}

/** Escenario minimo: un proyecto con lotes y un cliente. */
export async function crearEscenario(prisma: PrismaService) {
  const proyecto = await prisma.proyecto.create({
    data: { codigo: 'P1', nombre: 'Proyecto de prueba', areaMinimaM2: dec('1000') },
  });

  const lotes = await Promise.all(
    ['L-01', 'L-02', 'L-03'].map((codigo) =>
      prisma.lote.create({
        data: { proyectoId: proyecto.id, codigo, areaM2: dec('1200'), precioLista: dec('90000000') },
      }),
    ),
  );

  const cliente = await prisma.cliente.create({
    data: { documento: '1000000001', nombre: 'Cliente Uno', telefono: '3001234567' },
  });

  const otroCliente = await prisma.cliente.create({
    data: { documento: '1000000002', nombre: 'Cliente Dos', telefono: '3007654321' },
  });

  return { proyecto, lotes, cliente, otroCliente };
}

/** Extrae la cookie de acceso de la respuesta de login. */
export function cookieDe(res: { headers: Record<string, unknown> }): string {
  const crudo = res.headers['set-cookie'];
  const cookies = Array.isArray(crudo) ? crudo : [String(crudo ?? '')];
  return cookies.map((c) => c.split(';')[0]).join('; ');
}
