import { Injectable } from '@nestjs/common';
import { Prisma } from '@terranova/db';
import {
  ErrorNoEncontrado,
  type Pagina,
  type PagoVigente,
  type RegistrarPagoInput,
  aTexto,
  assertPagoAnulable,
  assertPagoValido,
  calcularEstadoCuenta,
} from '@terranova/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditoriaService } from '../../common/auditoria/auditoria.service.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';
import { VentasService } from '../ventas/ventas.service.js';

const dec = (v: string) => new Prisma.Decimal(v);

@Injectable()
export class PagosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly ventas: VentasService,
  ) {}

  /* ======================================================================
     REGISTRAR PAGO
     ----------------------------------------------------------------------
     El v0 validaba solo que el monto no excediera el saldo, y lo hacia en
     el navegador. Aqui se validan las siete reglas del dominio, en una
     transaccion, y la base las respalda con triggers por si alguna
     peticion llegara por otro camino.
     ====================================================================== */
  async registrar(datos: RegistrarPagoInput, usuario: UsuarioActual) {
    return this.prisma.$transaction(async (tx) => {
      // Bloqueo de la venta: serializa dos cajeros registrando a la vez,
      // de modo que el calculo del saldo no se haga sobre datos rancios.
      await tx.$queryRaw`SELECT id FROM ventas WHERE id = ${datos.ventaId}::uuid FOR UPDATE`;

      const venta = await tx.venta.findUnique({
        where: { id: datos.ventaId },
        include: {
          pagos: true,
          plan: { include: { cuotas: true } },
          lote: { select: { codigo: true } },
          cliente: { select: { documento: true, nombre: true } },
        },
      });
      if (!venta) throw new ErrorNoEncontrado('Venta', datos.ventaId);

      const pagosExistentes: PagoVigente[] = venta.pagos.map((p) => ({
        id: p.id,
        monto: p.monto.toString(),
        fecha: p.fecha,
        tipo: p.tipo,
        anulado: p.anulado,
      }));

      assertPagoValido(
        { monto: datos.monto, fecha: datos.fecha, tipo: datos.tipo },
        {
          precioNegociado: venta.precioNegociado.toString(),
          pagosExistentes,
          estadoVenta: venta.estado,
          fechaVenta: venta.fechaVenta,
        },
      );

      // Imputa a la primera cuota del mismo tipo que aun no este cubierta,
      // salvo que el usuario haya indicado la cuota explicitamente.
      const cuotaId = datos.cuotaId ?? this.elegirCuota(venta, datos.tipo);

      const pago = await tx.pago.create({
        data: {
          ventaId: venta.id,
          cuotaId,
          tipo: datos.tipo,
          monto: dec(datos.monto),
          fecha: datos.fecha,
          metodo: datos.metodo,
          referencia: datos.referencia ?? null,
          concepto: datos.concepto ?? null,
          registradoPorId: usuario.id,
        },
      });

      // Al llegar el saldo a cero, la venta pasa a LIQUIDADA y el lote a
      // PAGADO: la regla del documento original, ahora con aritmetica
      // exacta en lugar de `saldo === 0` sobre un float.
      await this.ventas.sincronizarEstado(venta.id, tx);

      await this.auditoria.registrar(
        {
          usuario,
          accion: 'PAGO_REGISTRADO',
          entidad: 'Pago',
          entidadId: pago.id,
          despues: {
            ventaNumero: venta.numero,
            lote: venta.lote.codigo,
            cliente: venta.cliente.documento,
            monto: aTexto(datos.monto),
            tipo: datos.tipo,
            metodo: datos.metodo,
          },
        },
        tx,
      );

      return pago;
    });
  }

  /* ======================================================================
     ANULAR PAGO
     ----------------------------------------------------------------------
     El v0 lo borraba del arreglo (Pagos.jsx:395). Aqui se marca anulado,
     con autor, fecha y motivo obligatorio, y se recalcula el estado: si la
     venta estaba LIQUIDADA vuelve a ACTIVA y el lote de PAGADO a VENDIDO.
     ====================================================================== */
  async anular(id: string, motivo: string, usuario: UsuarioActual) {
    return this.prisma.$transaction(async (tx) => {
      const pago = await tx.pago.findUnique({
        where: { id },
        include: { venta: { select: { id: true, numero: true } } },
      });
      if (!pago) throw new ErrorNoEncontrado('Pago', id);

      assertPagoAnulable(pago, motivo);

      const anulado = await tx.pago.update({
        where: { id },
        data: {
          anulado: true,
          anuladoEn: new Date(),
          anuladoPorId: usuario.id,
          motivoAnulacion: motivo,
        },
      });

      await this.ventas.sincronizarEstado(pago.venta.id, tx);

      await this.auditoria.registrar(
        {
          usuario,
          accion: 'PAGO_ANULADO',
          entidad: 'Pago',
          entidadId: id,
          antes: { monto: pago.monto.toFixed(2), fecha: pago.fecha, anulado: false },
          despues: { anulado: true, motivo },
        },
        tx,
      );

      return anulado;
    });
  }

  /* ======================================================================
     CONSULTAS
     ====================================================================== */

  async listar(filtro: {
    pagina: number;
    porPagina: number;
    proyectoId?: string;
    ventaId?: string;
    clienteId?: string;
    tipo?: string;
    metodo?: string;
    incluirAnulados: boolean;
    desde?: Date;
    hasta?: Date;
  }): Promise<Pagina<unknown>> {
    const where: Prisma.PagoWhereInput = {
      ...(filtro.ventaId ? { ventaId: filtro.ventaId } : {}),
      ...(filtro.tipo ? { tipo: filtro.tipo as never } : {}),
      ...(filtro.metodo ? { metodo: filtro.metodo as never } : {}),
      ...(filtro.incluirAnulados ? {} : { anulado: false }),
      ...(filtro.desde || filtro.hasta
        ? { fecha: { ...(filtro.desde ? { gte: filtro.desde } : {}), ...(filtro.hasta ? { lte: filtro.hasta } : {}) } }
        : {}),
      ...(filtro.clienteId || filtro.proyectoId
        ? {
            venta: {
              ...(filtro.clienteId ? { clienteId: filtro.clienteId } : {}),
              ...(filtro.proyectoId ? { lote: { proyectoId: filtro.proyectoId } } : {}),
            },
          }
        : {}),
    };

    const [datos, total] = await Promise.all([
      this.prisma.pago.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
        include: {
          venta: {
            select: {
              numero: true,
              precioNegociado: true,
              lote: { select: { codigo: true, proyecto: { select: { nombre: true } } } },
              cliente: { select: { documento: true, nombre: true } },
            },
          },
          registradoPor: { select: { nombre: true } },
          anuladoPor: { select: { nombre: true } },
          cuota: { select: { numero: true, descripcion: true } },
        },
      }),
      this.prisma.pago.count({ where }),
    ]);

    return {
      datos,
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
      totalPaginas: Math.max(1, Math.ceil(total / filtro.porPagina)),
    };
  }

  /** Estado de cuenta calculado con el dominio compartido. */
  async estadoCuenta(ventaId: string) {
    const venta = await this.prisma.venta.findUnique({
      where: { id: ventaId },
      include: { pagos: true, plan: { include: { cuotas: true } } },
    });
    if (!venta) throw new ErrorNoEncontrado('Venta', ventaId);

    return calcularEstadoCuenta({
      precioNegociado: venta.precioNegociado.toString(),
      pagos: venta.pagos.map((p) => ({
        id: p.id,
        monto: p.monto.toString(),
        fecha: p.fecha,
        tipo: p.tipo,
        anulado: p.anulado,
      })),
      cuotas: (venta.plan?.cuotas ?? []).map((c) => ({
        id: c.id,
        numero: c.numero,
        tipo: c.tipo,
        montoEsperado: c.montoEsperado.toString(),
        fechaVencimiento: c.fechaVencimiento,
      })),
    });
  }

  /**
   * Elige la cuota a la que imputar el pago: la primera del mismo tipo,
   * por orden de vencimiento. Si no hay coincidencia de tipo, queda sin
   * imputar y cuenta igual contra el saldo.
   */
  private elegirCuota(
    venta: { plan: { cuotas: Array<{ id: string; tipo: string; fechaVencimiento: Date }> } | null },
    tipo: string,
  ): string | null {
    const candidatas = (venta.plan?.cuotas ?? [])
      .filter((c) => c.tipo === tipo)
      .sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime());
    return candidatas[0]?.id ?? null;
  }
}
