#!/usr/bin/env tsx
/* ==========================================================================
   Importador de los datos del sistema anterior
   --------------------------------------------------------------------------
     pnpm migrar:legacy --archivo datos.json            (ensayo)
     pnpm migrar:legacy --archivo datos.json --aplicar   (escribe)

   Por defecto corre en seco: analiza, reporta y no toca la base.
   ========================================================================== */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { config as cargarEnv } from 'dotenv';
import * as argon2 from 'argon2';
import { Prisma, PrismaClient } from '@terranova/db';
import { aTexto, calcularPlanPago, dinero, esPositivo, restar } from '@terranova/shared';
import { type Incidencia, normalizar } from './normalizar.js';

cargarEnv({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });

const { values } = parseArgs({
  // pnpm reenvia el separador `--` como argumento literal; sin
  // allowPositionals, parseArgs lo rechaza antes de leer las banderas.
  allowPositionals: true,
  options: {
    archivo: { type: 'string', short: 'a' },
    aplicar: { type: 'boolean', default: false },
    informe: { type: 'string', default: 'informe-migracion.json' },
  },
});

if (!values.archivo) {
  console.error(`
Uso:
  pnpm migrar:legacy --archivo <export.json> [--aplicar]

  --archivo   JSON generado por tools/migracion-localstorage/src/exportador.html
  --aplicar   Escribe en la base de datos. Sin esta bandera solo analiza.
  --informe   Ruta del informe de incidencias (por defecto informe-migracion.json)
`);
  process.exit(1);
}

const prisma = new PrismaClient();
const dec = (v: unknown) => new Prisma.Decimal(aTexto(v as string));

async function main(): Promise<void> {
  const crudo = JSON.parse(await readFile(resolve(values.archivo!), 'utf8')) as Record<string, unknown>;
  const r = normalizar(crudo);

  console.log('\n=== ANALISIS DEL EXPORTADO ===\n');
  console.log(`  Proyectos  ${r.proyectos.length}`);
  console.log(`  Clientes   ${r.clientes.length}`);
  console.log(`  Lotes      ${r.lotes.length}  (${r.lotes.filter((l) => l.areaInferida).length} sin area original)`);
  console.log(`  Ventas     ${r.ventas.length}  (${r.ventas.filter((v) => v.reconstruida).length} reconstruidas del estado del lote)`);
  console.log(`  Pagos      ${r.pagos.length}`);

  const errores = r.incidencias.filter((i) => i.nivel === 'error');
  const avisos = r.incidencias.filter((i) => i.nivel === 'aviso');

  console.log(`\n  Incidencias: ${errores.length} error(es), ${avisos.length} aviso(s)`);
  for (const i of [...errores, ...avisos].slice(0, 20)) {
    console.log(`    [${i.nivel}] ${i.entidad}: ${i.detalle}`);
  }
  if (r.incidencias.length > 20) {
    console.log(`    … y ${r.incidencias.length - 20} más (ver el informe)`);
  }

  await escribirInforme(values.informe!, r.incidencias, r);

  if (!values.aplicar) {
    console.log(`\n  ENSAYO: no se escribio nada en la base.`);
    console.log(`  Revise ${values.informe} y vuelva a ejecutar con --aplicar.\n`);
    return;
  }

  console.log('\n=== IMPORTANDO ===\n');
  await importar(r);
}

async function importar(r: ReturnType<typeof normalizar>): Promise<void> {
  // Usuario que queda como autor de todo lo importado, para que la
  // auditoria distinga lo migrado de lo capturado en el sistema nuevo.
  const importador = await prisma.usuario.upsert({
    where: { email: 'migracion@terranova.co' },
    update: {},
    create: {
      email: 'migracion@terranova.co',
      nombre: 'Importación de datos anteriores',
      passwordHash: await argon2.hash(crypto.randomUUID(), { type: argon2.argon2id }),
      rol: 'ADMIN',
      activo: false, // No puede iniciar sesion: solo existe como autor.
    },
  });

  const proyectoPorCodigo = new Map<string, string>();
  for (const p of r.proyectos) {
    const creado = await prisma.proyecto.upsert({
      where: { codigo: p.codigo },
      update: {},
      create: { codigo: p.codigo, nombre: p.nombre, estado: p.estado },
    });
    proyectoPorCodigo.set(p.codigo, creado.id);
  }

  // Proyecto de respaldo para los lotes huerfanos.
  if (r.lotes.some((l) => !proyectoPorCodigo.has(l.proyectoCodigo))) {
    const sueltos = await prisma.proyecto.upsert({
      where: { codigo: 'SIN-PROYECTO' },
      update: {},
      create: { codigo: 'SIN-PROYECTO', nombre: 'Lotes sin proyecto asignado', estado: 'PAUSADO' },
    });
    for (const l of r.lotes) {
      if (!proyectoPorCodigo.has(l.proyectoCodigo)) {
        proyectoPorCodigo.set(l.proyectoCodigo, sueltos.id);
      }
    }
  }
  console.log(`  ${proyectoPorCodigo.size} proyecto(s)`);

  const clientePorDocumento = new Map<string, string>();
  for (const c of r.clientes) {
    const creado = await prisma.cliente.upsert({
      where: { documento: c.documento },
      update: {},
      create: {
        documento: c.documento,
        nombre: c.nombre,
        telefono: c.telefono,
        email: c.email,
        direccion: c.direccion,
        ciudad: c.ciudad,
        observaciones: c.observaciones,
      },
    });
    clientePorDocumento.set(c.documento, creado.id);
  }
  console.log(`  ${clientePorDocumento.size} cliente(s)`);

  const lotePorClave = new Map<string, string>();
  for (const l of r.lotes) {
    const proyectoId = proyectoPorCodigo.get(l.proyectoCodigo)!;
    const creado = await prisma.lote.upsert({
      where: { proyectoId_codigo: { proyectoId, codigo: l.codigo } },
      update: {},
      create: {
        proyectoId,
        codigo: l.codigo,
        areaM2: new Prisma.Decimal(String(l.areaM2)),
        precioLista: esPositivo(l.precioLista) ? dec(l.precioLista) : new Prisma.Decimal('1'),
        estado: 'DISPONIBLE',
        observaciones: [
          l.areaInferida ? 'Área no registrada en el sistema anterior; verificar.' : null,
          esPositivo(l.precioLista) ? null : 'Precio no registrado; se importó como $1.',
        ]
          .filter(Boolean)
          .join(' ') || null,
      },
    });
    lotePorClave.set(l.claveOriginal, creado.id);
  }
  console.log(`  ${lotePorClave.size} lote(s)`);

  // Las ventas se crean con su plan de pago; los pagos se imputan despues.
  let ventasCreadas = 0;
  for (const v of r.ventas) {
    const loteId = lotePorClave.get(v.loteClave);
    const clienteId = clientePorDocumento.get(v.compradorDocumento);
    if (!loteId || !clienteId) continue;

    const pagosDelLote = r.pagos.filter((p) => p.loteClave === v.loteClave);
    const precio = esPositivo(v.precioNegociado) ? v.precioNegociado : dinero('1');

    // El v0 no guardaba plan de pago. Se reconstruye uno de dos cuotas con
    // lo efectivamente abonado como cuota inicial, que es lo que mas se
    // acerca a la realidad sin inventar condiciones.
    const abonado = pagosDelLote.reduce((t, p) => t.plus(p.monto), dinero(0));
    const inicial = abonado.greaterThan(precio) ? precio : abonado;

    const plan = calcularPlanPago({
      precioNegociado: precio,
      cuotaInicial: esPositivo(inicial) ? inicial : precio.times('0.1').toDecimalPlaces(2),
      fechaVenta: v.fechaVenta,
      modalidad: {
        tipo: 'DOS_PAGOS',
        // Plazo de referencia: un ano desde la venta. Es un dato que hay
        // que confirmar con el cliente, y queda anotado en la venta.
        fechaLimitePagoFinal: new Date(
          Date.UTC(v.fechaVenta.getUTCFullYear() + 1, v.fechaVenta.getUTCMonth(), v.fechaVenta.getUTCDate()),
        ),
      },
    });

    await prisma.$transaction(async (tx) => {
      const venta = await tx.venta.create({
        data: {
          loteId,
          clienteId,
          precioNegociado: dec(plan.precioNegociado),
          fechaVenta: v.fechaVenta,
          registradoPorId: importador.id,
          observaciones: v.reconstruida
            ? 'Venta reconstruida en la migración: el sistema anterior no guardaba el registro de venta. Verificar precio, fecha y plazo.'
            : 'Importada del sistema anterior. Verificar plazo del pago final.',
          plan: {
            create: {
              modalidad: 'DOS_PAGOS',
              cuotaInicial: dec(plan.cuotaInicial),
              saldoFinanciado: dec(plan.saldoFinanciado),
              numeroCuotas: plan.cuotas.length,
              cuotas: {
                create: plan.cuotas.map((c) => ({
                  numero: c.numero,
                  tipo: c.tipo,
                  montoEsperado: dec(c.montoEsperado),
                  fechaVencimiento: c.fechaVencimiento,
                  descripcion: c.descripcion,
                })),
              },
            },
          },
        },
      });

      for (const p of pagosDelLote) {
        if (!esPositivo(p.monto)) continue;
        await tx.pago.create({
          data: {
            ventaId: venta.id,
            tipo: p.tipo,
            monto: dec(p.monto),
            fecha: p.fecha < v.fechaVenta ? v.fechaVenta : p.fecha,
            metodo: 'EFECTIVO',
            concepto: p.concepto ?? 'Importado del sistema anterior',
            registradoPorId: importador.id,
          },
        });
      }

      const liquidada = restar(plan.precioNegociado, abonado).isZero();
      await tx.lote.update({
        where: { id: loteId },
        data: { estado: liquidada ? 'PAGADO' : 'VENDIDO' },
      });
      if (liquidada) {
        await tx.venta.update({ where: { id: venta.id }, data: { estado: 'LIQUIDADA' } });
      }

      await tx.auditLog.create({
        data: {
          usuarioId: importador.id,
          accion: v.reconstruida ? 'VENTA_RECONSTRUIDA_EN_MIGRACION' : 'VENTA_IMPORTADA',
          entidad: 'Venta',
          entidadId: venta.id,
          despues: { loteClave: v.loteClave, documento: v.compradorDocumento },
        },
      });
    });

    ventasCreadas++;
  }

  console.log(`  ${ventasCreadas} venta(s) con su plan y pagos`);
  console.log('\n  Importación terminada.\n');
}

async function escribirInforme(
  ruta: string,
  incidencias: Incidencia[],
  resumen: ReturnType<typeof normalizar>,
): Promise<void> {
  await writeFile(
    resolve(ruta),
    JSON.stringify(
      {
        generadoEn: new Date().toISOString(),
        resumen: {
          proyectos: resumen.proyectos.length,
          clientes: resumen.clientes.length,
          lotes: resumen.lotes.length,
          lotesSinArea: resumen.lotes.filter((l) => l.areaInferida).length,
          ventas: resumen.ventas.length,
          ventasReconstruidas: resumen.ventas.filter((v) => v.reconstruida).length,
          pagos: resumen.pagos.length,
        },
        incidencias,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\n  Informe escrito en ${ruta}`);
}

main()
  .catch((e: unknown) => {
    console.error('\nLa migración falló:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
