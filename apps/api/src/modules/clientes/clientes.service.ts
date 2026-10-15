import { Injectable } from '@nestjs/common';
import { Prisma } from '@terranova/db';
import {
  type CrearClienteInput,
  ErrorNoEncontrado,
  type Pagina,
  assertClienteEliminable,
  assertDocumentoValido,
} from '@terranova/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditoriaService } from '../../common/auditoria/auditoria.service.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Busqueda insensible a acentos y mayusculas, respaldada por el indice
   * GIN de prisma/sql. El v0 concatenaba campos y hacia `includes()` sobre
   * el arreglo completo en memoria, asi que "José" no encontraba "Jose".
   */
  async listar(filtro: {
    pagina: number;
    porPagina: number;
    buscar?: string;
    activo?: boolean;
    proyectoId?: string;
  }): Promise<Pagina<unknown>> {
    const where: Prisma.ClienteWhereInput = {
      ...(filtro.activo !== undefined ? { activo: filtro.activo } : {}),
      ...(filtro.proyectoId
        ? { ventas: { some: { estado: { not: 'ANULADA' }, lote: { proyectoId: filtro.proyectoId } } } }
        : {}),
    };

    // El filtro de texto va por SQL para aprovechar unaccent + trigram.
    if (filtro.buscar) {
      const patron = `%${filtro.buscar.toLowerCase()}%`;
      const ids = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM clientes
         WHERE lower(inmutable_unaccent(nombre)) LIKE ${patron}
            OR documento LIKE ${patron}
            OR lower(coalesce(ciudad, '')) LIKE ${patron}
            OR telefono LIKE ${patron}
      `;
      where.id = { in: ids.map((r) => r.id) };
    }

    const [datos, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        orderBy: { nombre: 'asc' },
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
        include: {
          _count: { select: { ventas: { where: { estado: { not: 'ANULADA' } } } } },
        },
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return {
      datos,
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
      totalPaginas: Math.max(1, Math.ceil(total / filtro.porPagina)),
    };
  }

  /**
   * Ficha del cliente con su cartera consolidada de todos los proyectos.
   * Imposible en el v0, donde el mismo comprador se duplicaba por proyecto
   * y cada copia llevaba su propio saldo.
   */
  async obtener(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: {
        ventas: {
          orderBy: { fechaVenta: 'desc' },
          include: {
            lote: { select: { codigo: true, areaM2: true, proyecto: { select: { nombre: true } } } },
            plan: { include: { cuotas: { orderBy: { numero: 'asc' } } } },
          },
        },
      },
    });
    if (!cliente) throw new ErrorNoEncontrado('Cliente', id);

    const cartera = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT venta_id, venta_numero, proyecto_nombre, lote_codigo,
             precio_negociado, total_pagado, saldo, estado_cartera, total_en_mora
        FROM venta_estado_cuenta
       WHERE cliente_id = ${id}::uuid
       ORDER BY fecha_venta DESC
    `;

    const [totales] = await this.prisma.$queryRaw<
      Array<{ comprado: string; pagado: string; saldo: string; en_mora: string }>
    >`
      SELECT COALESCE(SUM(precio_negociado), 0) AS comprado,
             COALESCE(SUM(total_pagado), 0)     AS pagado,
             COALESCE(SUM(saldo), 0)            AS saldo,
             COALESCE(SUM(total_en_mora), 0)    AS en_mora
        FROM venta_estado_cuenta
       WHERE cliente_id = ${id}::uuid AND estado_venta <> 'ANULADA'
    `;

    return { ...cliente, cartera, totales };
  }

  async crear(datos: CrearClienteInput, usuario: UsuarioActual) {
    assertDocumentoValido(datos.documento);

    const cliente = await this.prisma.cliente.create({
      data: {
        tipoDocumento: datos.tipoDocumento,
        documento: datos.documento,
        nombre: datos.nombre,
        telefono: datos.telefono,
        email: datos.email ?? null,
        direccion: datos.direccion ?? null,
        ciudad: datos.ciudad ?? null,
        observaciones: datos.observaciones ?? null,
      },
    });

    await this.auditoria.registrar({
      usuario,
      accion: 'CLIENTE_CREADO',
      entidad: 'Cliente',
      entidadId: cliente.id,
      despues: { documento: cliente.documento, nombre: cliente.nombre },
    });

    return cliente;
  }

  async actualizar(id: string, datos: Partial<CrearClienteInput>, usuario: UsuarioActual) {
    const antes = await this.prisma.cliente.findUnique({ where: { id } });
    if (!antes) throw new ErrorNoEncontrado('Cliente', id);

    if (datos.documento !== undefined) assertDocumentoValido(datos.documento);

    const cliente = await this.prisma.cliente.update({
      where: { id },
      data: {
        ...(datos.tipoDocumento !== undefined ? { tipoDocumento: datos.tipoDocumento } : {}),
        ...(datos.documento !== undefined ? { documento: datos.documento } : {}),
        ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
        ...(datos.telefono !== undefined ? { telefono: datos.telefono } : {}),
        ...(datos.email !== undefined ? { email: datos.email } : {}),
        ...(datos.direccion !== undefined ? { direccion: datos.direccion } : {}),
        ...(datos.ciudad !== undefined ? { ciudad: datos.ciudad } : {}),
        ...(datos.observaciones !== undefined ? { observaciones: datos.observaciones } : {}),
      },
    });

    await this.auditoria.registrar({
      usuario,
      accion: 'CLIENTE_ACTUALIZADO',
      entidad: 'Cliente',
      entidadId: id,
      antes: { documento: antes.documento, nombre: antes.nombre, telefono: antes.telefono },
      despues: datos,
    });

    return cliente;
  }

  /** Desactiva en lugar de borrar cuando hay historial. */
  async desactivar(id: string, usuario: UsuarioActual) {
    const cliente = await this.prisma.cliente.update({
      where: { id },
      data: { activo: false },
    });
    await this.auditoria.registrar({
      usuario,
      accion: 'CLIENTE_DESACTIVADO',
      entidad: 'Cliente',
      entidadId: id,
    });
    return cliente;
  }

  async reactivar(id: string, usuario: UsuarioActual) {
    const cliente = await this.prisma.cliente.update({ where: { id }, data: { activo: true } });
    await this.auditoria.registrar({
      usuario,
      accion: 'CLIENTE_REACTIVADO',
      entidad: 'Cliente',
      entidadId: id,
    });
    return cliente;
  }

  async eliminar(id: string, usuario: UsuarioActual): Promise<void> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: { _count: { select: { ventas: { where: { estado: { not: 'ANULADA' } } } } } },
    });
    if (!cliente) throw new ErrorNoEncontrado('Cliente', id);

    // El v0 borraba por indice de arreglo, sin mirar si el cliente tenia
    // compras: la venta quedaba apuntando a la nada.
    assertClienteEliminable(cliente._count.ventas);

    await this.prisma.cliente.delete({ where: { id } });
    await this.auditoria.registrar({
      usuario,
      accion: 'CLIENTE_ELIMINADO',
      entidad: 'Cliente',
      entidadId: id,
      antes: { documento: cliente.documento, nombre: cliente.nombre },
    });
  }
}
