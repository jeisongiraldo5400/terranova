import { Injectable } from '@nestjs/common';
import { Prisma, type VentaEstadoCuentaRow } from '@terranova/db';
import {
  ErrorNoEncontrado,
  ErrorReglaNegocio,
  type Pagina,
  type RegistrarVentaInput,
  aTexto,
  assertFechaVentaValida,
  assertLoteVendible,
  assertTransicionLote,
  assertVentaAnulable,
  calcularPlanPago,
  dinero,
  esCero,
  restar,
} from '@terranova/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditoriaService } from '../../common/auditoria/auditoria.service.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';

const dec = (v: string) => new Prisma.Decimal(v);

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /* ======================================================================
     REGISTRAR VENTA
     ----------------------------------------------------------------------
     Este es el caso de uso que estaba roto en el v0. En pages/Ventas.jsx
     la funcion realizarVenta():

       1. Marcaba el lote como 'Vendido' y generaba el PDF.
       2. NUNCA escribia la clave `ventas` de localStorage.
       3. Leia `clienteActual.id`, pero los clientes se guardaban sin `id`,
          asi que lanzaba TypeError.
       4. No habia transaccion: dos usuarios podian vender el mismo lote.

     Como Pagos.jsx y Contratos.jsx leian `ventas` para poblarse, esos dos
     modulos (2.144 lineas) quedaban permanentemente vacios.

     Aqui todo ocurre en una sola transaccion, con bloqueo pesimista sobre
     el lote y respaldado por el indice unico parcial de la base.
     ====================================================================== */
  async registrar(datos: RegistrarVentaInput, usuario: UsuarioActual) {
    return this.prisma.$transaction(
      async (tx) => {
        // --- Bloqueo del lote -------------------------------------------
        // SELECT ... FOR UPDATE serializa a los competidores: el segundo
        // espera y encuentra el lote ya vendido en lugar de duplicar.
        const filas = await tx.$queryRaw<
          Array<{
            id: string;
            codigo: string;
            estado: string;
            area_m2: Prisma.Decimal;
            proyecto_id: string;
            area_minima_m2: Prisma.Decimal;
          }>
        >`
          SELECT l.id, l.codigo, l.estado::text AS estado, l.area_m2,
                 l.proyecto_id, p.area_minima_m2
            FROM lotes l
            JOIN proyectos p ON p.id = l.proyecto_id
           WHERE l.id = ${datos.loteId}::uuid
             FOR UPDATE OF l
        `;

        const lote = filas[0];
        if (!lote) throw new ErrorNoEncontrado('Lote', datos.loteId);

        assertLoteVendible(lote.estado as never, lote.codigo);
        assertTransicionLote(lote.estado as never, 'VENDIDO');
        assertFechaVentaValida(datos.fechaVenta);

        const cliente = await tx.cliente.findUnique({ where: { id: datos.clienteId } });
        if (!cliente) throw new ErrorNoEncontrado('Cliente', datos.clienteId);
        if (!cliente.activo) {
          throw new ErrorReglaNegocio('El cliente esta desactivado y no puede realizar compras.');
        }

        // --- Plan de pago, calculado por el dominio compartido ----------
        // calcularPlanPago garantiza que las cuotas sumen exactamente el
        // precio; el trigger diferido de la base lo verifica al confirmar.
        const plan = calcularPlanPago({
          precioNegociado: datos.precioNegociado,
          cuotaInicial: datos.cuotaInicial,
          porcentajeInicial: datos.porcentajeInicial,
          fechaVenta: datos.fechaVenta,
          modalidad:
            datos.modalidad.tipo === 'DOS_PAGOS'
              ? {
                  tipo: 'DOS_PAGOS',
                  fechaLimitePagoFinal: datos.modalidad.fechaLimitePagoFinal,
                }
              : {
                  tipo: 'CUOTAS',
                  numeroCuotas: datos.modalidad.numeroCuotas,
                  diaPago: datos.modalidad.diaPago,
                },
        });

        const venta = await tx.venta.create({
          data: {
            loteId: lote.id,
            clienteId: cliente.id,
            precioNegociado: dec(aTexto(plan.precioNegociado)),
            fechaVenta: datos.fechaVenta,
            observaciones: datos.observaciones ?? null,
            registradoPorId: usuario.id,
            plan: {
              create: {
                modalidad: datos.modalidad.tipo,
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
          include: {
            plan: { include: { cuotas: { orderBy: { numero: 'asc' } } } },
            lote: { include: { proyecto: true, etapa: true } },
            cliente: true,
          },
        });

        await tx.lote.update({ where: { id: lote.id }, data: { estado: 'VENDIDO' } });

        await this.auditoria.registrar(
          {
            usuario,
            accion: 'VENTA_REGISTRADA',
            entidad: 'Venta',
            entidadId: venta.id,
            despues: {
              numero: venta.numero,
              lote: lote.codigo,
              cliente: cliente.documento,
              precioNegociado: aTexto(plan.precioNegociado),
            },
          },
          tx,
        );

        return venta;
      },
      // El bloqueo del lote es breve; si hay contencion real preferimos
      // fallar antes que mantener la fila tomada.
      { timeout: 15_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  /* ======================================================================
     ANULAR VENTA
     ----------------------------------------------------------------------
     Operacion inexistente en el v0: una vez vendido, el lote quedaba
     vendido para siempre. Aqui se anula sin borrar nada, se liberan el
     lote y los pagos, y queda el motivo registrado.
     ====================================================================== */
  async anular(
    id: string,
    datos: { motivo: string; anularPagos: boolean },
    usuario: UsuarioActual,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findUnique({
        where: { id },
        include: { lote: true, pagos: { where: { anulado: false } } },
      });
      if (!venta) throw new ErrorNoEncontrado('Venta', id);

      assertVentaAnulable(venta.estado);

      if (venta.pagos.length > 0 && !datos.anularPagos) {
        throw new ErrorReglaNegocio(
          `Esta venta tiene ${venta.pagos.length} pago(s) vigente(s). ` +
            'Confirme que desea anularlos junto con la venta.',
          { pagosVigentes: venta.pagos.length },
        );
      }

      const ahora = new Date();

      if (datos.anularPagos) {
        await tx.pago.updateMany({
          where: { ventaId: id, anulado: false },
          data: {
            anulado: true,
            anuladoEn: ahora,
            anuladoPorId: usuario.id,
            motivoAnulacion: `Anulacion de la venta ${venta.numero}: ${datos.motivo}`,
          },
        });
      }

      const anulada = await tx.venta.update({
        where: { id },
        data: {
          estado: 'ANULADA',
          anuladoEn: ahora,
          anuladoPorId: usuario.id,
          motivoAnulacion: datos.motivo,
        },
      });

      // El lote vuelve a estar disponible. La transicion se valida contra
      // la maquina de estados, no se asigna a mano.
      assertTransicionLote(venta.lote.estado, 'DISPONIBLE');
      await tx.lote.update({ where: { id: venta.loteId }, data: { estado: 'DISPONIBLE' } });

      await this.auditoria.registrar(
        {
          usuario,
          accion: 'VENTA_ANULADA',
          entidad: 'Venta',
          entidadId: id,
          antes: { estado: venta.estado, loteEstado: venta.lote.estado },
          despues: {
            estado: 'ANULADA',
            motivo: datos.motivo,
            pagosAnulados: datos.anularPagos ? venta.pagos.length : 0,
          },
        },
        tx,
      );

      return anulada;
    });
  }

  /* ======================================================================
     CONSULTAS
     ====================================================================== */

  /**
   * Listado con el estado de cuenta ya resuelto por la vista SQL, de modo
   * que el saldo y el estado de cartera salen de una sola formula.
   */
  async listar(filtro: {
    pagina: number;
    porPagina: number;
    proyectoId?: string;
    clienteId?: string;
    estado?: string;
    estadoCartera?: string;
    buscar?: string;
    desde?: Date;
    hasta?: Date;
  }): Promise<Pagina<VentaEstadoCuentaRow>> {
    const condiciones: Prisma.Sql[] = [];

    if (filtro.proyectoId) condiciones.push(Prisma.sql`proyecto_id = ${filtro.proyectoId}::uuid`);
    if (filtro.clienteId) condiciones.push(Prisma.sql`cliente_id = ${filtro.clienteId}::uuid`);
    if (filtro.estado) condiciones.push(Prisma.sql`estado_venta = ${filtro.estado}::"EstadoVenta"`);
    if (filtro.estadoCartera) condiciones.push(Prisma.sql`estado_cartera = ${filtro.estadoCartera}`);
    if (filtro.desde) condiciones.push(Prisma.sql`fecha_venta >= ${filtro.desde}`);
    if (filtro.hasta) condiciones.push(Prisma.sql`fecha_venta <= ${filtro.hasta}`);

    if (filtro.buscar) {
      const patron = `%${filtro.buscar.toLowerCase()}%`;
      condiciones.push(Prisma.sql`(
        lower(inmutable_unaccent(cliente_nombre)) LIKE ${patron}
        OR cliente_documento LIKE ${patron}
        OR lower(lote_codigo) LIKE ${patron}
        OR venta_numero::text LIKE ${patron}
      )`);
    }

    const where =
      condiciones.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
        : Prisma.empty;

    const [datos, conteo] = await Promise.all([
      this.prisma.$queryRaw<VentaEstadoCuentaRow[]>`
        SELECT * FROM venta_estado_cuenta
        ${where}
        ORDER BY fecha_venta DESC, venta_numero DESC
        LIMIT ${filtro.porPagina} OFFSET ${(filtro.pagina - 1) * filtro.porPagina}
      `,
      this.prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT count(*) AS total FROM venta_estado_cuenta ${where}
      `,
    ]);

    const total = Number(conteo[0]?.total ?? 0);

    return {
      datos,
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
      totalPaginas: Math.max(1, Math.ceil(total / filtro.porPagina)),
    };
  }

  /** Venta con su plan, cuotas, pagos y estado de cuenta. */
  async obtener(id: string) {
    const venta = await this.prisma.venta.findUnique({
      where: { id },
      include: {
        lote: { include: { proyecto: true, etapa: true } },
        cliente: true,
        plan: { include: { cuotas: { orderBy: { numero: 'asc' } } } },
        pagos: { orderBy: { fecha: 'asc' }, include: { registradoPor: { select: { nombre: true } } } },
        contratos: { orderBy: { version: 'desc' } },
        registradoPor: { select: { id: true, nombre: true } },
        anuladoPor: { select: { id: true, nombre: true } },
      },
    });

    if (!venta) throw new ErrorNoEncontrado('Venta', id);

    const [cuenta] = await this.prisma.$queryRaw<VentaEstadoCuentaRow[]>`
      SELECT * FROM venta_estado_cuenta WHERE venta_id = ${id}::uuid
    `;

    const cuotas = await this.prisma.$queryRaw<
      Array<Record<string, unknown>>
    >`SELECT * FROM cuota_estado WHERE venta_id = ${id}::uuid ORDER BY numero`;

    return { ...venta, cuenta, cuotasEstado: cuotas };
  }

  /**
   * Sincroniza el estado de la venta y del lote con el saldo real.
   * Se invoca despues de registrar o anular un pago. Es idempotente: no
   * guarda el saldo, solo deriva el estado a partir de el.
   */
  async sincronizarEstado(ventaId: string, tx: Prisma.TransactionClient): Promise<void> {
    const venta = await tx.venta.findUniqueOrThrow({
      where: { id: ventaId },
      include: { lote: true },
    });

    if (venta.estado === 'ANULADA') return;

    const agregado = await tx.pago.aggregate({
      where: { ventaId, anulado: false },
      _sum: { monto: true },
    });

    const pagado = dinero((agregado._sum.monto ?? dec('0')).toString());
    const saldo = restar(venta.precioNegociado.toString(), pagado);
    const liquidada = esCero(saldo);

    const estadoVenta = liquidada ? 'LIQUIDADA' : 'ACTIVA';
    const estadoLote = liquidada ? 'PAGADO' : 'VENDIDO';

    if (venta.estado !== estadoVenta) {
      await tx.venta.update({ where: { id: ventaId }, data: { estado: estadoVenta } });
    }
    if (venta.lote.estado !== estadoLote) {
      assertTransicionLote(venta.lote.estado, estadoLote);
      await tx.lote.update({ where: { id: venta.loteId }, data: { estado: estadoLote } });
    }
  }
}
