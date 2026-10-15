import { Injectable } from '@nestjs/common';
import { Prisma } from '@terranova/db';
import {
  type CrearLoteInput,
  ErrorNoEncontrado,
  ErrorReglaNegocio,
  type Pagina,
  assertAreaMinima,
  assertLoteEditable,
  assertPrecioValido,
  assertTransicionLote,
  estaComprometido,
} from '@terranova/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditoriaService } from '../../common/auditoria/auditoria.service.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';

@Injectable()
export class LotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtro: {
    pagina: number;
    porPagina: number;
    proyectoId?: string;
    etapaId?: string;
    estado?: string;
    buscar?: string;
    areaMin?: number;
    areaMax?: number;
  }): Promise<Pagina<unknown>> {
    const where: Prisma.LoteWhereInput = {
      ...(filtro.proyectoId ? { proyectoId: filtro.proyectoId } : {}),
      ...(filtro.etapaId ? { etapaId: filtro.etapaId } : {}),
      ...(filtro.estado ? { estado: filtro.estado as never } : {}),
      ...(filtro.buscar ? { codigo: { contains: filtro.buscar.toUpperCase() } } : {}),
      ...(filtro.areaMin || filtro.areaMax
        ? {
            areaM2: {
              ...(filtro.areaMin ? { gte: new Prisma.Decimal(String(filtro.areaMin)) } : {}),
              ...(filtro.areaMax ? { lte: new Prisma.Decimal(String(filtro.areaMax)) } : {}),
            },
          }
        : {}),
    };

    const [datos, total] = await Promise.all([
      this.prisma.lote.findMany({
        where,
        orderBy: { codigo: 'asc' },
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
        include: {
          proyecto: { select: { id: true, codigo: true, nombre: true } },
          etapa: { select: { id: true, numero: true, nombre: true } },
          ventas: {
            where: { estado: { not: 'ANULADA' } },
            select: {
              id: true,
              numero: true,
              precioNegociado: true,
              fechaVenta: true,
              cliente: { select: { id: true, documento: true, nombre: true } },
            },
          },
        },
      }),
      this.prisma.lote.count({ where }),
    ]);

    return {
      datos,
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
      totalPaginas: Math.max(1, Math.ceil(total / filtro.porPagina)),
    };
  }

  /** Conteo por estado, para los tableros de inventario. */
  async conteoPorEstado(proyectoId?: string) {
    const grupos = await this.prisma.lote.groupBy({
      by: ['estado'],
      where: proyectoId ? { proyectoId } : {},
      _count: { _all: true },
      _sum: { precioLista: true, areaM2: true },
    });

    return grupos.map((g) => ({
      estado: g.estado,
      cantidad: g._count._all,
      valorLista: g._sum.precioLista?.toFixed(2) ?? '0.00',
      areaTotal: g._sum.areaM2?.toFixed(2) ?? '0.00',
    }));
  }

  async crear(datos: CrearLoteInput, usuario: UsuarioActual) {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: datos.proyectoId } });
    if (!proyecto) throw new ErrorNoEncontrado('Proyecto', datos.proyectoId);

    // Regla del documento original. El v0 no podia aplicarla porque el
    // formulario de lotes no tenia campo de area.
    assertAreaMinima(datos.areaM2, Number(proyecto.areaMinimaM2));
    assertPrecioValido(datos.precioLista, 'El precio de lista');

    const lote = await this.prisma.lote.create({
      data: {
        proyectoId: datos.proyectoId,
        etapaId: datos.etapaId ?? null,
        codigo: datos.codigo,
        areaM2: new Prisma.Decimal(String(datos.areaM2)),
        precioLista: new Prisma.Decimal(datos.precioLista),
        observaciones: datos.observaciones ?? null,
      },
    });

    await this.auditoria.registrar({
      usuario,
      accion: 'LOTE_CREADO',
      entidad: 'Lote',
      entidadId: lote.id,
      despues: { codigo: lote.codigo, areaM2: lote.areaM2.toFixed(2), precio: lote.precioLista.toFixed(2) },
    });

    return lote;
  }

  /**
   * Creacion masiva: una manzana completa en una sola operacion. El v0
   * obligaba a capturar los lotes uno por uno.
   */
  async crearEnLote(
    datos: {
      proyectoId: string;
      etapaId?: string | null;
      prefijo: string;
      desde: number;
      hasta: number;
      areaM2: number;
      precioLista: string;
    },
    usuario: UsuarioActual,
  ) {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: datos.proyectoId } });
    if (!proyecto) throw new ErrorNoEncontrado('Proyecto', datos.proyectoId);

    assertAreaMinima(datos.areaM2, Number(proyecto.areaMinimaM2));
    assertPrecioValido(datos.precioLista, 'El precio de lista');

    const cantidad = datos.hasta - datos.desde + 1;
    if (cantidad > 200) {
      throw new ErrorReglaNegocio('No se pueden crear mas de 200 lotes en una sola operacion.');
    }

    const filas = Array.from({ length: cantidad }, (_, i) => ({
      proyectoId: datos.proyectoId,
      etapaId: datos.etapaId ?? null,
      codigo: `${datos.prefijo}${String(datos.desde + i).padStart(2, '0')}`,
      areaM2: new Prisma.Decimal(String(datos.areaM2)),
      precioLista: new Prisma.Decimal(datos.precioLista),
    }));

    const resultado = await this.prisma.lote.createMany({ data: filas, skipDuplicates: true });

    await this.auditoria.registrar({
      usuario,
      accion: 'LOTES_CREADOS_EN_LOTE',
      entidad: 'Lote',
      despues: {
        proyectoId: datos.proyectoId,
        rango: `${datos.prefijo}${datos.desde}-${datos.hasta}`,
        creados: resultado.count,
        omitidosPorDuplicado: cantidad - resultado.count,
      },
    });

    return { creados: resultado.count, omitidos: cantidad - resultado.count };
  }

  async actualizar(
    id: string,
    datos: Partial<CrearLoteInput> & { estado?: string },
    usuario: UsuarioActual,
  ) {
    const lote = await this.prisma.lote.findUnique({
      where: { id },
      include: { proyecto: { select: { areaMinimaM2: true } } },
    });
    if (!lote) throw new ErrorNoEncontrado('Lote', id);

    // Un lote vendido o pagado no se toca sin anular la venta primero.
    const cambiaDatosDeNegocio =
      datos.areaM2 !== undefined || datos.precioLista !== undefined || datos.codigo !== undefined;
    if (cambiaDatosDeNegocio) assertLoteEditable(lote.estado);

    if (datos.areaM2 !== undefined) {
      assertAreaMinima(datos.areaM2, Number(lote.proyecto.areaMinimaM2));
    }
    if (datos.precioLista !== undefined) {
      assertPrecioValido(datos.precioLista, 'El precio de lista');
    }
    if (datos.estado !== undefined) {
      // Cambiar el estado a mano solo vale para movimientos que no son
      // consecuencia de una venta (reservar, bloquear, liberar).
      if (estaComprometido(datos.estado as never) && !estaComprometido(lote.estado)) {
        throw new ErrorReglaNegocio(
          'Un lote no pasa a VENDIDO o PAGADO a mano: registre la venta correspondiente.',
        );
      }
      assertTransicionLote(lote.estado, datos.estado as never);
    }

    const actualizado = await this.prisma.lote.update({
      where: { id },
      data: {
        ...(datos.codigo !== undefined ? { codigo: datos.codigo } : {}),
        ...(datos.etapaId !== undefined ? { etapaId: datos.etapaId } : {}),
        ...(datos.areaM2 !== undefined ? { areaM2: new Prisma.Decimal(String(datos.areaM2)) } : {}),
        ...(datos.precioLista !== undefined
          ? { precioLista: new Prisma.Decimal(datos.precioLista) }
          : {}),
        ...(datos.estado !== undefined ? { estado: datos.estado as never } : {}),
        ...(datos.observaciones !== undefined ? { observaciones: datos.observaciones } : {}),
      },
    });

    await this.auditoria.registrar({
      usuario,
      accion: 'LOTE_ACTUALIZADO',
      entidad: 'Lote',
      entidadId: id,
      antes: {
        codigo: lote.codigo,
        areaM2: lote.areaM2.toFixed(2),
        precioLista: lote.precioLista.toFixed(2),
        estado: lote.estado,
      },
      despues: datos,
    });

    return actualizado;
  }

  async eliminar(id: string, usuario: UsuarioActual): Promise<void> {
    const lote = await this.prisma.lote.findUnique({
      where: { id },
      include: { _count: { select: { ventas: true } } },
    });
    if (!lote) throw new ErrorNoEncontrado('Lote', id);

    assertLoteEditable(lote.estado);

    if (lote._count.ventas > 0) {
      throw new ErrorReglaNegocio(
        'El lote tiene historial de ventas y no puede eliminarse. Puede bloquearlo.',
        { ventas: lote._count.ventas },
      );
    }

    await this.prisma.lote.delete({ where: { id } });
    await this.auditoria.registrar({
      usuario,
      accion: 'LOTE_ELIMINADO',
      entidad: 'Lote',
      entidadId: id,
      antes: { codigo: lote.codigo },
    });
  }
}
