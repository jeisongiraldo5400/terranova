/* ==========================================================================
   Seed de desarrollo
   --------------------------------------------------------------------------
   Crea un escenario completo y realista: usuarios de los tres roles, un
   proyecto con etapas y lotes, clientes, ventas con plan de pago y pagos
   en distintos estados de cartera (al dia, parcial, liquidada, en mora).

   Sirve para probar la UI sin capturar datos a mano y para que los tests
   e2e partan de un estado conocido.
   ========================================================================== */

import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import {
  calcularPlanPago,
  dinero,
  aTexto,
  porcentaje,
  restar,
} from '@terranova/shared';
import { PrismaClient, Prisma } from '../generated/client/index.js';

const prisma = new PrismaClient();

const dec = (v: string) => new Prisma.Decimal(v);
const fecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** argon2id con parametros acordes a OWASP. */
const hash = (clave: string) =>
  argon2.hash(clave, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

async function main() {
  console.log('Sembrando base de datos de desarrollo...\n');

  // ----------------------------------------------------------------------
  // Limpieza
  // ----------------------------------------------------------------------
  // En una sola transaccion: borrar por pasos sueltos deja estados
  // intermedios confirmados que las invariantes rechazan (por ejemplo, un
  // plan de pago sin cuotas).
  //
  // No se borran cuotas ni planes de forma explicita: caen por cascada al
  // eliminar la venta. Los pagos van antes porque su relacion con la venta
  // es Restrict, a proposito, para que nunca desaparezca dinero por efecto
  // colateral de otra operacion.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.contrato.deleteMany(),
    prisma.pago.deleteMany(),
    prisma.venta.deleteMany(),
    prisma.lote.deleteMany(),
    prisma.etapa.deleteMany(),
    prisma.proyecto.deleteMany(),
    prisma.cliente.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.usuario.deleteMany(),
    prisma.configuracionEmpresa.deleteMany(),
  ]);

  // ----------------------------------------------------------------------
  // Configuracion de la empresa (alimenta el encabezado del contrato)
  // ----------------------------------------------------------------------
  await prisma.configuracionEmpresa.create({
    data: {
      id: 1,
      razonSocial: 'Urbanizacion Terranova S.A.S.',
      nit: '9001234567',
      direccion: 'Carrera 45 No. 23-14, Oficina 302',
      ciudad: 'Monteria',
      telefono: '6047891234',
      email: 'contacto@terranova.co',
      representanteLegal: 'Carlos Manuel Munoz Guzman',
      documentoRepresentante: '1067891234',
      clausulasContrato: [
        'PRIMERA. OBJETO: El VENDEDOR transfiere a titulo de compraventa al',
        'COMPRADOR el lote de terreno identificado en este contrato.',
        '',
        'SEGUNDA. PRECIO Y FORMA DE PAGO: El precio acordado se pagara segun el',
        'plan de pagos detallado, mediante cuota inicial y saldo final.',
        '',
        'TERCERA. ENTREGA: La entrega material del lote se realizara una vez',
        'cancelado el cien por ciento (100%) del precio acordado.',
        '',
        'CUARTA. INCUMPLIMIENTO: El retardo superior a noventa (90) dias en el',
        'pago de cualquier cuota faculta al VENDEDOR para declarar resuelto el',
        'contrato, previo requerimiento escrito.',
      ].join('\n'),
    },
  });

  // ----------------------------------------------------------------------
  // Usuarios: los tres roles del documento original
  // ----------------------------------------------------------------------
  const claveDemo = process.env.SEED_ADMIN_PASSWORD ?? 'Cambiar.2026';

  const admin = await prisma.usuario.create({
    data: {
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@terranova.co',
      nombre: 'Carlos Munoz',
      passwordHash: await hash(claveDemo),
      rol: 'ADMIN',
    },
  });

  const secretaria = await prisma.usuario.create({
    data: {
      email: 'secretaria@terranova.co',
      nombre: 'Luisa Fernanda Rios',
      passwordHash: await hash(claveDemo),
      rol: 'SECRETARIA',
    },
  });

  await prisma.usuario.create({
    data: {
      email: 'empleado@terranova.co',
      nombre: 'Andres Felipe Mora',
      passwordHash: await hash(claveDemo),
      rol: 'EMPLEADO',
    },
  });

  console.log('  3 usuarios (ADMIN, SECRETARIA, EMPLEADO)');

  // ----------------------------------------------------------------------
  // Proyecto con etapas
  // ----------------------------------------------------------------------
  const proyecto = await prisma.proyecto.create({
    data: {
      codigo: 'TERRANOVA-1',
      nombre: 'Terranova Etapa Norte',
      ubicacion: 'Vereda El Cerrito, Monteria, Cordoba',
      estado: 'ACTIVO',
      areaMinimaM2: dec('1000'),
      etapas: {
        create: [
          { numero: 1, nombre: 'Etapa I - Manzanas A y B' },
          { numero: 2, nombre: 'Etapa II - Manzanas C y D' },
        ],
      },
    },
    include: { etapas: true },
  });

  const [etapa1, etapa2] = proyecto.etapas;

  const segundo = await prisma.proyecto.create({
    data: {
      codigo: 'MIRADOR',
      nombre: 'El Mirador',
      ubicacion: 'Km 4 via Planeta Rica',
      estado: 'ACTIVO',
      areaMinimaM2: dec('1000'),
      etapas: { create: [{ numero: 1, nombre: 'Unica' }] },
    },
    include: { etapas: true },
  });

  console.log('  2 proyectos con 3 etapas');

  // ----------------------------------------------------------------------
  // Lotes. Todos cumplen el minimo de 1000 m2 -- el trigger de la base
  // rechazaria cualquiera que no lo haga.
  // ----------------------------------------------------------------------
  const lotesData: Prisma.LoteCreateManyInput[] = [];

  // Manzana A: 1.000 a 1.350 m2
  for (let i = 1; i <= 8; i++) {
    const area = 1000 + i * 50;
    lotesData.push({
      id: randomUUID(),
      proyectoId: proyecto.id,
      etapaId: etapa1!.id,
      codigo: `MZ-A${String(i).padStart(2, '0')}`,
      areaM2: dec(String(area)),
      precioLista: dec(String(area * 75_000)),
    });
  }

  // Manzana B: lotes mas grandes, esquineros
  for (let i = 1; i <= 6; i++) {
    const area = 1400 + i * 100;
    lotesData.push({
      id: randomUUID(),
      proyectoId: proyecto.id,
      etapaId: etapa2!.id,
      codigo: `MZ-B${String(i).padStart(2, '0')}`,
      areaM2: dec(String(area)),
      precioLista: dec(String(area * 82_000)),
    });
  }

  for (let i = 1; i <= 4; i++) {
    lotesData.push({
      id: randomUUID(),
      proyectoId: segundo.id,
      etapaId: segundo.etapas[0]!.id,
      codigo: `MIR-${String(i).padStart(2, '0')}`,
      areaM2: dec('1200'),
      precioLista: dec('96000000'),
    });
  }

  await prisma.lote.createMany({ data: lotesData });
  console.log(`  ${lotesData.length} lotes (todos >= 1000 m2)`);

  // ----------------------------------------------------------------------
  // Clientes. Documento unico global: quien compre en dos proyectos es el
  // mismo registro, no dos como en el v0.
  // ----------------------------------------------------------------------
  const clientes = await Promise.all(
    [
      { documento: '1067891001', nombre: 'Jose Manuel Perez Diaz', telefono: '3104567801', ciudad: 'Monteria' },
      { documento: '1067891002', nombre: 'Maria Camila Ortega Ruiz', telefono: '3115678902', ciudad: 'Cerete' },
      { documento: '1067891003', nombre: 'Luis Alberto Gomez Salas', telefono: '3126789003', ciudad: 'Monteria' },
      { documento: '1067891004', nombre: 'Ana Sofia Martinez Leon', telefono: '3137890104', ciudad: 'Sahagun' },
      { documento: '1067891005', nombre: 'Jorge Eliecer Narvaez Paz', telefono: '3148901205', ciudad: 'Monteria' },
      { documento: '900456789', nombre: 'Inversiones del Sinu S.A.S.', telefono: '6047894561', ciudad: 'Monteria', tipoDocumento: 'NIT' as const },
    ].map((c) =>
      prisma.cliente.create({
        data: {
          ...c,
          email: `${c.nombre.split(' ')[0]!.toLowerCase()}@correo.co`,
          direccion: 'Calle 20 No. 10-30',
        },
      }),
    ),
  );

  console.log(`  ${clientes.length} clientes`);

  // ----------------------------------------------------------------------
  // Ventas con plan de pago y pagos
  // ----------------------------------------------------------------------
  const lotes = await prisma.lote.findMany({
    where: { proyectoId: proyecto.id },
    orderBy: { codigo: 'asc' },
  });

  /**
   * Crea una venta completa en una sola transaccion: venta, plan, cuotas y
   * pagos. El plan lo calcula el dominio compartido, de modo que las cuotas
   * siempre suman el precio -- el trigger diferido de la base lo verifica.
   */
  async function crearVenta(opciones: {
    lote: (typeof lotes)[number];
    clienteId: string;
    precioNegociado: string;
    fechaVenta: Date;
    porcentajeInicial: number;
    fechaLimitePagoFinal: Date;
    pagos: Array<{ monto: string; fecha: Date; tipo: 'CUOTA_INICIAL' | 'ABONO' | 'PAGO_FINAL' }>;
    anularUltimoPago?: boolean;
  }) {
    const plan = calcularPlanPago({
      precioNegociado: opciones.precioNegociado,
      porcentajeInicial: opciones.porcentajeInicial,
      fechaVenta: opciones.fechaVenta,
      modalidad: { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: opciones.fechaLimitePagoFinal },
    });

    return prisma.$transaction(async (tx) => {
      const venta = await tx.venta.create({
        data: {
          loteId: opciones.lote.id,
          clienteId: opciones.clienteId,
          precioNegociado: dec(aTexto(plan.precioNegociado)),
          fechaVenta: opciones.fechaVenta,
          registradoPorId: secretaria.id,
          plan: {
            create: {
              modalidad: 'DOS_PAGOS',
              cuotaInicial: dec(aTexto(plan.cuotaInicial)),
              saldoFinanciado: dec(aTexto(plan.saldoFinanciado)),
              numeroCuotas: plan.cuotas.length,
              cuotas: {
                create: plan.cuotas.map((c) => ({
                  numero: c.numero,
                  tipo: c.tipo,
                  montoEsperado: dec(aTexto(c.montoEsperado)),
                  fechaVencimiento: c.fechaVencimiento,
                  descripcion: c.descripcion,
                })),
              },
            },
          },
        },
        include: { plan: { include: { cuotas: true } } },
      });

      for (const [i, p] of opciones.pagos.entries()) {
        const cuota = venta.plan!.cuotas.find((c) => c.tipo === p.tipo);
        const esUltimo = i === opciones.pagos.length - 1;
        const anular = opciones.anularUltimoPago === true && esUltimo;

        await tx.pago.create({
          data: {
            ventaId: venta.id,
            cuotaId: cuota?.id ?? null,
            tipo: p.tipo,
            monto: dec(p.monto),
            fecha: p.fecha,
            metodo: 'TRANSFERENCIA',
            referencia: `TRF-${Math.floor(Math.random() * 900000 + 100000)}`,
            concepto: cuota?.descripcion ?? 'Abono',
            registradoPorId: secretaria.id,
            // Un pago anulado conserva el rastro completo, nunca se borra.
            ...(anular
              ? {
                  anulado: true,
                  anuladoEn: new Date(),
                  anuladoPorId: admin.id,
                  motivoAnulacion: 'Consignacion devuelta por el banco, fondos insuficientes.',
                }
              : {}),
          },
        });
      }

      // El estado del lote se deriva del saldo, no se escribe a mano.
      const pagosVigentes = await tx.pago.aggregate({
        where: { ventaId: venta.id, anulado: false },
        _sum: { monto: true },
      });
      const pagado = dinero((pagosVigentes._sum.monto ?? dec('0')).toString());
      const liquidada = restar(plan.precioNegociado, pagado).isZero();

      await tx.lote.update({
        where: { id: opciones.lote.id },
        data: { estado: liquidada ? 'PAGADO' : 'VENDIDO' },
      });

      if (liquidada) {
        await tx.venta.update({ where: { id: venta.id }, data: { estado: 'LIQUIDADA' } });
      }

      return venta;
    });
  }

  // --- Venta 1: liquidada por completo (lote -> PAGADO) -----------------
  const precio1 = '82500000';
  await crearVenta({
    lote: lotes[0]!,
    clienteId: clientes[0]!.id,
    precioNegociado: precio1,
    fechaVenta: fecha('2026-01-20'),
    porcentajeInicial: 30,
    fechaLimitePagoFinal: fecha('2026-07-20'),
    pagos: [
      { monto: aTexto(porcentaje(precio1, 30)), fecha: fecha('2026-01-20'), tipo: 'CUOTA_INICIAL' },
      { monto: aTexto(restar(precio1, porcentaje(precio1, 30))), fecha: fecha('2026-06-10'), tipo: 'PAGO_FINAL' },
    ],
  });

  // --- Venta 2: cuota inicial pagada, saldo al dia ----------------------
  const precio2 = '86250000';
  await crearVenta({
    lote: lotes[1]!,
    clienteId: clientes[1]!.id,
    precioNegociado: precio2,
    fechaVenta: fecha('2026-03-05'),
    porcentajeInicial: 25,
    fechaLimitePagoFinal: fecha('2026-12-05'),
    pagos: [
      { monto: aTexto(porcentaje(precio2, 25)), fecha: fecha('2026-03-05'), tipo: 'CUOTA_INICIAL' },
    ],
  });

  // --- Venta 3: EN MORA, el pago final vencio sin cubrirse --------------
  const precio3 = '90000000';
  await crearVenta({
    lote: lotes[2]!,
    clienteId: clientes[2]!.id,
    precioNegociado: precio3,
    fechaVenta: fecha('2025-11-10'),
    porcentajeInicial: 20,
    fechaLimitePagoFinal: fecha('2026-05-10'),
    pagos: [
      { monto: aTexto(porcentaje(precio3, 20)), fecha: fecha('2025-11-10'), tipo: 'CUOTA_INICIAL' },
    ],
  });

  // --- Venta 4: con un pago anulado, para ver la trazabilidad ----------
  const precio4 = '95000000';
  await crearVenta({
    lote: lotes[3]!,
    clienteId: clientes[3]!.id,
    precioNegociado: precio4,
    fechaVenta: fecha('2026-04-15'),
    porcentajeInicial: 30,
    fechaLimitePagoFinal: fecha('2026-11-15'),
    pagos: [
      { monto: aTexto(porcentaje(precio4, 30)), fecha: fecha('2026-04-15'), tipo: 'CUOTA_INICIAL' },
      { monto: '10000000', fecha: fecha('2026-05-20'), tipo: 'ABONO' },
    ],
    anularUltimoPago: true,
  });

  // --- Lote reservado, sin venta aun -----------------------------------
  await prisma.lote.update({ where: { id: lotes[4]!.id }, data: { estado: 'RESERVADO' } });

  // --- El mismo cliente compra en el segundo proyecto -------------------
  const lotesMirador = await prisma.lote.findMany({ where: { proyectoId: segundo.id } });
  await crearVenta({
    lote: lotesMirador[0]!,
    clienteId: clientes[0]!.id, // mismo cliente de la venta 1
    precioNegociado: '96000000',
    fechaVenta: fecha('2026-05-02'),
    porcentajeInicial: 40,
    fechaLimitePagoFinal: fecha('2027-05-02'),
    pagos: [{ monto: '38400000', fecha: fecha('2026-05-02'), tipo: 'CUOTA_INICIAL' }],
  });

  console.log('  5 ventas con plan de pago, pagos y un pago anulado');

  // ----------------------------------------------------------------------
  // Verificacion: la vista de cartera debe cuadrar
  // ----------------------------------------------------------------------
  const resumen = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT proyecto_nombre, cliente_nombre, lote_codigo,
            precio_negociado, total_pagado, saldo, estado_cartera
       FROM venta_estado_cuenta
      ORDER BY proyecto_nombre, lote_codigo`,
  );

  console.log('\n  Cartera resultante:');
  for (const r of resumen) {
    console.log(
      `    ${String(r.lote_codigo).padEnd(9)} ${String(r.cliente_nombre).slice(0, 26).padEnd(28)}` +
        ` saldo ${String(r.saldo).padStart(14)}  ${r.estado_cartera}`,
    );
  }

  console.log('\nListo.');
  console.log(`  Ingreso: ${process.env.SEED_ADMIN_EMAIL ?? 'admin@terranova.co'} / ${claveDemo}`);
}

main()
  .catch((e) => {
    console.error('\nError al sembrar:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
