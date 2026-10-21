#!/usr/bin/env tsx
/* ==========================================================================
   Datos de ejemplo
   --------------------------------------------------------------------------
   Puebla la base con un escenario realista para recorrer el sistema:
   proyectos con etapas, inventario en todos los estados, clientes, ventas
   que cubren cada estado de cartera, pagos por distintos metodos y algunos
   anulados.

   A diferencia de `seed`, NO BORRA NADA: usa upsert por codigo o documento,
   de modo que puede ejecutarse sobre una base que ya tiene informacion y
   volver a ejecutarse sin duplicar.

   Los contratos no se crean aqui: necesitan generar el PDF y su huella
   sha256, que es trabajo de la API. Se emiten despues desde la interfaz o
   con POST /api/contratos.

     pnpm db:ejemplos
   ========================================================================== */

import {
  aTexto, calcularPlanPago, dinero, porcentaje, restar,
} from '@terranova/shared';
import { Prisma, PrismaClient } from '../generated/client/index.js';

const prisma = new PrismaClient();

const dec = (v: string) => new Prisma.Decimal(v);

/** Hoy a medianoche UTC: las fechas de negocio son dias calendario. */
const HOY = new Date(
  Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
);

/** Fecha relativa a hoy, en dias hacia atras. */
const haceDias = (d: number) => new Date(HOY.getTime() - d * 86_400_000);
const haceMeses = (m: number) =>
  new Date(Date.UTC(HOY.getUTCFullYear(), HOY.getUTCMonth() - m, HOY.getUTCDate()));

async function main(): Promise<void> {
  console.log('\nCreando datos de ejemplo…\n');

  // ----------------------------------------------------------------------
  // Usuarios. Se conserva el administrador existente; se agregan los otros
  // dos roles para poder comprobar los permisos en pantalla.
  // ----------------------------------------------------------------------
  const admin = await prisma.usuario.findFirst({
    where: { rol: 'ADMIN', activo: true },
    orderBy: { creadoEn: 'asc' },
  });
  if (!admin) {
    throw new Error('No hay un administrador activo. Ejecute antes: pnpm db:arranque');
  }

  // argon2 de "Demo.Terranova2026" — se escribe el hash para no depender de
  // la libreria aqui; los dos usuarios son solo para ver la matriz de roles.
  const CLAVE_DEMO = 'Demo.Terranova2026';
  const { hash } = await import('argon2');
  const hashDemo = await hash(CLAVE_DEMO, {
    type: 2, memoryCost: 19456, timeCost: 2, parallelism: 1,
  });

  for (const u of [
    { email: 'secretaria@terranova.co', nombre: 'Luisa Fernanda Ríos', rol: 'SECRETARIA' as const },
    { email: 'empleado@terranova.co', nombre: 'Andrés Felipe Mora', rol: 'EMPLEADO' as const },
  ]) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash: hashDemo },
    });
  }
  console.log('  Usuarios     : administrador existente + secretaria y empleado');

  // ----------------------------------------------------------------------
  // Proyectos y etapas
  // ----------------------------------------------------------------------
  const defProyectos = [
    {
      codigo: 'TERRANOVA-1',
      nombre: 'Terranova Etapa Norte',
      ubicacion: 'Vereda El Cerrito, Montería, Córdoba',
      estado: 'ACTIVO' as const,
      etapas: ['Etapa I · Manzanas A y B', 'Etapa II · Manzanas C y D'],
    },
    {
      codigo: 'MIRADOR',
      nombre: 'El Mirador',
      ubicacion: 'Km 4 vía Planeta Rica, Córdoba',
      estado: 'ACTIVO' as const,
      etapas: ['Única'],
    },
    {
      codigo: 'VILLA-CAMPESTRE',
      nombre: 'Villa Campestre',
      ubicacion: 'Corregimiento Las Palomas, Montería',
      estado: 'ACTIVO' as const,
      etapas: ['Sector Lago', 'Sector Bosque'],
    },
    {
      codigo: 'PORTAL-SINU',
      nombre: 'Portal del Sinú',
      ubicacion: 'Margen izquierda del río, Montería',
      estado: 'PAUSADO' as const,
      etapas: ['Única'],
    },
  ];

  const proyectos: Record<string, { id: string; etapas: { id: string; nombre: string }[] }> = {};

  for (const p of defProyectos) {
    const creado = await prisma.proyecto.upsert({
      where: { codigo: p.codigo },
      update: {},
      create: {
        codigo: p.codigo,
        nombre: p.nombre,
        ubicacion: p.ubicacion,
        estado: p.estado,
        areaMinimaM2: dec('1000'),
      },
    });

    const etapas = [];
    for (const [i, nombre] of p.etapas.entries()) {
      etapas.push(
        await prisma.etapa.upsert({
          where: { proyectoId_numero: { proyectoId: creado.id, numero: i + 1 } },
          update: {},
          create: { proyectoId: creado.id, numero: i + 1, nombre },
        }),
      );
    }
    proyectos[p.codigo] = { id: creado.id, etapas };
  }
  console.log(`  Proyectos    : ${defProyectos.length} (uno pausado) con sus etapas`);

  // ----------------------------------------------------------------------
  // Lotes. Area y precio varian por manzana para que los reportes tengan
  // cifras distintas; el precio por m2 sube con la cercania al lago.
  // ----------------------------------------------------------------------
  const defLotes: Array<{
    proyecto: string; etapa: number; prefijo: string; desde: number; hasta: number;
    areaBase: number; precioM2: number;
  }> = [
    { proyecto: 'TERRANOVA-1', etapa: 0, prefijo: 'MZ-A', desde: 1, hasta: 10, areaBase: 1050, precioM2: 75_000 },
    { proyecto: 'TERRANOVA-1', etapa: 1, prefijo: 'MZ-C', desde: 1, hasta: 8, areaBase: 1400, precioM2: 82_000 },
    { proyecto: 'MIRADOR', etapa: 0, prefijo: 'MIR', desde: 1, hasta: 10, areaBase: 1200, precioM2: 80_000 },
    { proyecto: 'VILLA-CAMPESTRE', etapa: 0, prefijo: 'LAGO', desde: 1, hasta: 8, areaBase: 1600, precioM2: 105_000 },
    { proyecto: 'VILLA-CAMPESTRE', etapa: 1, prefijo: 'BOSQ', desde: 1, hasta: 8, areaBase: 1300, precioM2: 92_000 },
    { proyecto: 'PORTAL-SINU', etapa: 0, prefijo: 'PS', desde: 1, hasta: 6, areaBase: 1100, precioM2: 70_000 },
  ];

  const lotesPorCodigo: Record<string, { id: string; precio: string; proyecto: string }> = {};

  for (const def of defLotes) {
    const p = proyectos[def.proyecto]!;
    for (let n = def.desde; n <= def.hasta; n++) {
      const codigo = `${def.prefijo}${String(n).padStart(2, '0')}`;
      // El area crece un poco con el numero de lote: los del fondo son
      // mas grandes, como suele ocurrir en un loteo real.
      const area = def.areaBase + (n - 1) * 50;
      const precio = String(area * def.precioM2);

      const lote = await prisma.lote.upsert({
        where: { proyectoId_codigo: { proyectoId: p.id, codigo } },
        update: {},
        create: {
          proyectoId: p.id,
          etapaId: p.etapas[def.etapa]!.id,
          codigo,
          areaM2: dec(String(area)),
          precioLista: dec(precio),
        },
      });
      lotesPorCodigo[codigo] = { id: lote.id, precio, proyecto: def.proyecto };
    }
  }
  console.log(`  Lotes        : ${Object.keys(lotesPorCodigo).length} entre los cuatro proyectos`);

  // ----------------------------------------------------------------------
  // Clientes
  // ----------------------------------------------------------------------
  const defClientes = [
    { documento: '1067891001', nombre: 'José Manuel Pérez Díaz', telefono: '3104567801', ciudad: 'Montería' },
    { documento: '1067891002', nombre: 'María Camila Ortega Ruiz', telefono: '3115678902', ciudad: 'Cereté' },
    { documento: '1067891003', nombre: 'Luis Alberto Gómez Salas', telefono: '3126789003', ciudad: 'Montería' },
    { documento: '1067891004', nombre: 'Ana Sofía Martínez León', telefono: '3137890104', ciudad: 'Sahagún' },
    { documento: '1067891005', nombre: 'Jorge Eliécer Narváez Paz', telefono: '3148901205', ciudad: 'Montería' },
    { documento: '1067891006', nombre: 'Claudia Patricia Vega Mora', telefono: '3159012306', ciudad: 'Lorica' },
    { documento: '1067891007', nombre: 'Rosa Elena Jiménez Cárdenas', telefono: '3160123407', ciudad: 'Montería' },
    { documento: '1067891008', nombre: 'Hernán Darío Castro Oviedo', telefono: '3171234508', ciudad: 'Planeta Rica' },
    { documento: '1067891009', nombre: 'Diana Marcela Soto Ramos', telefono: '3182345609', ciudad: 'Montería' },
    { documento: '1067891010', nombre: 'Álvaro Enrique Pacheco Luna', telefono: '3193456710', ciudad: 'Cereté' },
    { documento: '900456789', nombre: 'Inversiones del Sinú S.A.S.', telefono: '6047894561', ciudad: 'Montería', tipoDocumento: 'NIT' as const },
    { documento: '901223344', nombre: 'Constructora Bellavista S.A.S.', telefono: '6047891122', ciudad: 'Montería', tipoDocumento: 'NIT' as const },
  ];

  const clientes: Record<string, string> = {};
  for (const c of defClientes) {
    const creado = await prisma.cliente.upsert({
      where: { documento: c.documento },
      update: {},
      create: {
        ...c,
        email: `${c.nombre.split(' ')[0]!.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@correo.co`,
        direccion: 'Calle 20 No. 10-30',
      },
    });
    clientes[c.documento] = creado.id;
  }
  console.log(`  Clientes     : ${defClientes.length} (incluye dos empresas con NIT)`);

  // ----------------------------------------------------------------------
  // Ventas
  // ----------------------------------------------------------------------
  // Cada entrada define cuanto se ha pagado y cuando, de modo que el
  // escenario cubra los cuatro estados de cartera y la anulacion.
  // ----------------------------------------------------------------------
  interface DefVenta {
    lote: string;
    cliente: string;
    descuento?: number;          // % sobre el precio de lista
    haceMeses: number;           // antiguedad de la venta
    pctInicial: number;
    modalidad: 'DOS_PAGOS' | 'CUOTAS';
    cuotas?: number;
    /** Fracciones del precio ya abonadas, con su antiguedad en dias. */
    pagos: Array<{ fraccion: number; haceDias: number; metodo: 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'CONSIGNACION'; anulado?: boolean }>;
    anularVenta?: string;
    reservado?: boolean;
  }

  const defVentas: DefVenta[] = [
    // --- Liquidadas: lote queda PAGADO ---
    { lote: 'MZ-A01', cliente: '1067891001', haceMeses: 14, pctInicial: 30, modalidad: 'DOS_PAGOS',
      pagos: [{ fraccion: 0.30, haceDias: 420, metodo: 'TRANSFERENCIA' }, { fraccion: 0.70, haceDias: 240, metodo: 'TRANSFERENCIA' }] },
    { lote: 'LAGO01', cliente: '901223344', descuento: 5, haceMeses: 10, pctInicial: 50, modalidad: 'DOS_PAGOS',
      pagos: [{ fraccion: 0.50, haceDias: 300, metodo: 'TRANSFERENCIA' }, { fraccion: 0.50, haceDias: 95, metodo: 'CHEQUE' }] },

    // --- Al dia, abonando ---
    { lote: 'MZ-A02', cliente: '1067891002', haceMeses: 7, pctInicial: 25, modalidad: 'CUOTAS', cuotas: 12,
      pagos: [{ fraccion: 0.25, haceDias: 210, metodo: 'TRANSFERENCIA' }, { fraccion: 0.06, haceDias: 150, metodo: 'CONSIGNACION' }, { fraccion: 0.06, haceDias: 90, metodo: 'CONSIGNACION' }, { fraccion: 0.06, haceDias: 30, metodo: 'CONSIGNACION' }] },
    { lote: 'MIR01', cliente: '1067891001', haceMeses: 5, pctInicial: 40, modalidad: 'DOS_PAGOS',
      pagos: [{ fraccion: 0.40, haceDias: 150, metodo: 'TRANSFERENCIA' }] },
    { lote: 'BOSQ02', cliente: '1067891006', haceMeses: 3, pctInicial: 30, modalidad: 'CUOTAS', cuotas: 6,
      pagos: [{ fraccion: 0.30, haceDias: 90, metodo: 'EFECTIVO' }, { fraccion: 0.12, haceDias: 45, metodo: 'TRANSFERENCIA' }] },
    { lote: 'MZ-C01', cliente: '1067891009', haceMeses: 2, pctInicial: 20, modalidad: 'CUOTAS', cuotas: 24,
      pagos: [{ fraccion: 0.20, haceDias: 60, metodo: 'TRANSFERENCIA' }, { fraccion: 0.03, haceDias: 25, metodo: 'CONSIGNACION' }] },

    // --- En mora, de leve a grave ---
    { lote: 'MZ-A03', cliente: '1067891003', haceMeses: 12, pctInicial: 20, modalidad: 'DOS_PAGOS',
      pagos: [{ fraccion: 0.20, haceDias: 360, metodo: 'EFECTIVO' }] },
    { lote: 'MIR02', cliente: '900456789', haceMeses: 9, pctInicial: 15, modalidad: 'CUOTAS', cuotas: 6,
      pagos: [{ fraccion: 0.15, haceDias: 270, metodo: 'TRANSFERENCIA' }] },
    { lote: 'MIR03', cliente: '1067891005', haceMeses: 6, pctInicial: 20, modalidad: 'CUOTAS', cuotas: 4,
      pagos: [{ fraccion: 0.20, haceDias: 180, metodo: 'CHEQUE' }] },
    { lote: 'LAGO03', cliente: '1067891008', haceMeses: 8, pctInicial: 25, modalidad: 'DOS_PAGOS',
      pagos: [{ fraccion: 0.25, haceDias: 240, metodo: 'TRANSFERENCIA' }] },

    // --- Recien vendidas, sin abonos todavia ---
    { lote: 'BOSQ01', cliente: '1067891010', haceMeses: 0, pctInicial: 30, modalidad: 'DOS_PAGOS', pagos: [] },
    { lote: 'MZ-C02', cliente: '1067891004', haceMeses: 0, pctInicial: 35, modalidad: 'DOS_PAGOS', pagos: [] },

    // --- Con un pago anulado: cheque devuelto ---
    { lote: 'MZ-A04', cliente: '1067891007', haceMeses: 6, pctInicial: 30, modalidad: 'DOS_PAGOS',
      pagos: [
        { fraccion: 0.30, haceDias: 180, metodo: 'TRANSFERENCIA' },
        { fraccion: 0.20, haceDias: 60, metodo: 'CHEQUE', anulado: true },
      ] },

    // --- Anulada: el lote vuelve a quedar disponible ---
    { lote: 'MIR04', cliente: '1067891005', haceMeses: 4, pctInicial: 30, modalidad: 'DOS_PAGOS',
      pagos: [{ fraccion: 0.30, haceDias: 120, metodo: 'TRANSFERENCIA' }],
      anularVenta: 'El comprador se retractó dentro del plazo legal y se acordó la devolución.' },
  ];

  let ventasCreadas = 0;
  let pagosCreados = 0;

  for (const def of defVentas) {
    const lote = lotesPorCodigo[def.lote];
    if (!lote) continue;

    // No se duplica si ya existe una venta para ese lote.
    const previa = await prisma.venta.findFirst({
      where: { loteId: lote.id, estado: { not: 'ANULADA' } },
    });
    if (previa) continue;

    const precio = def.descuento
      ? aTexto(restar(lote.precio, porcentaje(lote.precio, def.descuento)))
      : lote.precio;

    const fechaVenta = haceMeses(def.haceMeses);

    const plan = calcularPlanPago({
      precioNegociado: precio,
      porcentajeInicial: def.pctInicial,
      fechaVenta,
      modalidad:
        def.modalidad === 'DOS_PAGOS'
          ? {
              tipo: 'DOS_PAGOS',
              // Plazo de un ano desde la venta.
              fechaLimitePagoFinal: new Date(
                Date.UTC(fechaVenta.getUTCFullYear() + 1, fechaVenta.getUTCMonth(), fechaVenta.getUTCDate()),
              ),
            }
          : { tipo: 'CUOTAS', numeroCuotas: def.cuotas ?? 12 },
    });

    await prisma.$transaction(async (tx) => {
      const venta = await tx.venta.create({
        data: {
          loteId: lote.id,
          clienteId: clientes[def.cliente]!,
          precioNegociado: dec(aTexto(plan.precioNegociado)),
          fechaVenta,
          registradoPorId: admin.id,
          observaciones: def.descuento ? `Descuento comercial del ${def.descuento}%.` : null,
          plan: {
            create: {
              modalidad: def.modalidad,
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

      for (const [i, p] of def.pagos.entries()) {
        const monto = aTexto(porcentaje(precio, p.fraccion * 100));
        // El pago nunca puede ser anterior a la venta: la base lo rechaza.
        const fechaPago = haceDias(p.haceDias) < fechaVenta ? fechaVenta : haceDias(p.haceDias);
        const tipo = i === 0 ? 'CUOTA_INICIAL' : 'ABONO';
        const cuota = venta.plan!.cuotas.find((c) => c.tipo === tipo);

        await tx.pago.create({
          data: {
            ventaId: venta.id,
            cuotaId: cuota?.id ?? null,
            tipo,
            monto: dec(monto),
            fecha: fechaPago,
            metodo: p.metodo,
            referencia:
              p.metodo === 'EFECTIVO'
                ? null
                : `${p.metodo.slice(0, 3)}-${Math.floor(Math.random() * 900000 + 100000)}`,
            concepto: cuota?.descripcion ?? 'Abono',
            registradoPorId: admin.id,
            ...(p.anulado
              ? {
                  anulado: true,
                  anuladoEn: haceDias(Math.max(0, p.haceDias - 5)),
                  anuladoPorId: admin.id,
                  motivoAnulacion: 'Cheque devuelto por el banco: fondos insuficientes.',
                }
              : {}),
          },
        });
        pagosCreados++;
      }

      // El estado se deriva del saldo, no se escribe a mano.
      const vigentes = await tx.pago.aggregate({
        where: { ventaId: venta.id, anulado: false },
        _sum: { monto: true },
      });
      const pagado = dinero((vigentes._sum.monto ?? dec('0')).toString());
      const liquidada = restar(plan.precioNegociado, pagado).isZero();

      if (def.anularVenta) {
        await tx.pago.updateMany({
          where: { ventaId: venta.id, anulado: false },
          data: {
            anulado: true,
            anuladoEn: haceDias(30),
            anuladoPorId: admin.id,
            motivoAnulacion: def.anularVenta,
          },
        });
        await tx.venta.update({
          where: { id: venta.id },
          data: {
            estado: 'ANULADA',
            anuladoEn: haceDias(30),
            anuladoPorId: admin.id,
            motivoAnulacion: def.anularVenta,
          },
        });
        await tx.lote.update({ where: { id: lote.id }, data: { estado: 'DISPONIBLE' } });
      } else {
        await tx.lote.update({
          where: { id: lote.id },
          data: { estado: liquidada ? 'PAGADO' : 'VENDIDO' },
        });
        if (liquidada) {
          await tx.venta.update({ where: { id: venta.id }, data: { estado: 'LIQUIDADA' } });
        }
      }

      await tx.auditLog.create({
        data: {
          usuarioId: admin.id,
          accion: 'VENTA_REGISTRADA',
          entidad: 'Venta',
          entidadId: venta.id,
          despues: { lote: def.lote, precio, origen: 'datos de ejemplo' },
        },
      });
    });

    ventasCreadas++;
  }
  console.log(`  Ventas       : ${ventasCreadas} cubriendo los cuatro estados de cartera`);
  console.log(`  Pagos        : ${pagosCreados} por distintos métodos, con uno anulado`);

  // ----------------------------------------------------------------------
  // Inventario restante: algunos reservados y uno bloqueado, para que el
  // tablero no muestre solo disponibles y vendidos.
  // ----------------------------------------------------------------------
  for (const [codigo, estado] of [
    ['MZ-A06', 'RESERVADO'], ['MIR06', 'RESERVADO'], ['LAGO05', 'RESERVADO'],
    ['BOSQ07', 'BLOQUEADO'],
  ] as const) {
    const l = lotesPorCodigo[codigo];
    if (!l) continue;
    const actual = await prisma.lote.findUnique({ where: { id: l.id } });
    if (actual?.estado !== 'DISPONIBLE') continue;
    await prisma.lote.update({
      where: { id: l.id },
      data: {
        estado,
        observaciones: estado === 'BLOQUEADO' ? 'Zona verde en revisión por planeación.' : null,
      },
    });
  }
  console.log('  Inventario   : 3 lotes reservados y 1 bloqueado');

  // ----------------------------------------------------------------------
  // Resumen
  // ----------------------------------------------------------------------
  const cartera = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT estado_cartera, count(*)::int AS ventas,
           to_char(sum(saldo), 'FM999,999,999,999') AS saldo
      FROM venta_estado_cuenta
     GROUP BY estado_cartera ORDER BY 1`);

  console.log('\n  Cartera resultante:');
  for (const c of cartera) {
    console.log(`    ${String(c.estado_cartera).padEnd(10)} ${String(c.ventas).padStart(2)} venta(s)   saldo ${String(c.saldo).padStart(14)}`);
  }

  const inventario = await prisma.lote.groupBy({ by: ['estado'], _count: { _all: true } });
  console.log('\n  Inventario:');
  for (const i of inventario) {
    console.log(`    ${i.estado.padEnd(11)} ${String(i._count._all).padStart(2)} lote(s)`);
  }

  console.log(`\n  Clave de secretaria y empleado: ${CLAVE_DEMO}`);
  console.log('  Los contratos se emiten desde el detalle de cada venta.\n');
}

main()
  .catch((e: unknown) => {
    console.error('\nFalló la creación de ejemplos:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
