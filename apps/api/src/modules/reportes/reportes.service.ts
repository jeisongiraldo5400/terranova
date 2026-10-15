/* ==========================================================================
   Reportes
   --------------------------------------------------------------------------
   El modulo Reportes del v0 eran cuatro lineas con solo el titulo:

       function Reportes() { return <h1>Reportes</h1>; }

   Aqui son seis reportes reales, resueltos en SQL sobre las vistas de
   cartera, con exportacion a CSV.
   ========================================================================== */

import { Injectable } from '@nestjs/common';
import { Prisma } from '@terranova/db';
import { formatearCifra } from '@terranova/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';

interface Filtro {
  proyectoId?: string;
  desde?: Date;
  hasta?: Date;
  fechaCorte?: Date;
}

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tablero principal: inventario, cartera y recaudo del mes. */
  async dashboard(proyectoId?: string) {
    const filtroProyecto = proyectoId
      ? Prisma.sql`WHERE proyecto_id = ${proyectoId}::uuid`
      : Prisma.empty;

    const [inventario, cartera, recaudoMensual, proximosVencimientos, mora] = await Promise.all([
      this.prisma.$queryRaw<Array<{ estado: string; cantidad: bigint; valor: string; area: string }>>`
        SELECT l.estado::text AS estado,
               count(*) AS cantidad,
               COALESCE(sum(l.precio_lista), 0) AS valor,
               COALESCE(sum(l.area_m2), 0) AS area
          FROM lotes l
         ${proyectoId ? Prisma.sql`WHERE l.proyecto_id = ${proyectoId}::uuid` : Prisma.empty}
         GROUP BY l.estado
         ORDER BY l.estado
      `,

      this.prisma.$queryRaw<
        Array<{ valor_vendido: string; recaudado: string; por_cobrar: string; en_mora: string; ventas: bigint }>
      >`
        SELECT COALESCE(sum(precio_negociado), 0) AS valor_vendido,
               COALESCE(sum(total_pagado), 0)     AS recaudado,
               COALESCE(sum(saldo), 0)            AS por_cobrar,
               COALESCE(sum(total_en_mora), 0)    AS en_mora,
               count(*)                            AS ventas
          FROM venta_estado_cuenta
         WHERE estado_venta <> 'ANULADA'
           ${proyectoId ? Prisma.sql`AND proyecto_id = ${proyectoId}::uuid` : Prisma.empty}
      `,

      // Recaudo de los ultimos 12 meses, para la grafica de tendencia.
      this.prisma.$queryRaw<Array<{ mes: string; recaudado: string; pagos: bigint }>>`
        SELECT to_char(date_trunc('month', p.fecha), 'YYYY-MM') AS mes,
               COALESCE(sum(p.monto), 0) AS recaudado,
               count(*) AS pagos
          FROM pagos p
          JOIN ventas v ON v.id = p.venta_id
          JOIN lotes  l ON l.id = v.lote_id
         WHERE p.anulado = FALSE
           AND p.fecha >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
           ${proyectoId ? Prisma.sql`AND l.proyecto_id = ${proyectoId}::uuid` : Prisma.empty}
         GROUP BY 1 ORDER BY 1
      `,

      // Cobros de los proximos 30 dias: lo que el v0 nunca pudo mostrar.
      this.prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT ce.venta_id, ce.numero, ce.descripcion, ce.monto_pendiente,
               ce.fecha_vencimiento, ec.cliente_nombre, ec.cliente_documento,
               ec.lote_codigo, ec.proyecto_nombre
          FROM cuota_estado ce
          JOIN venta_estado_cuenta ec ON ec.venta_id = ce.venta_id
         WHERE ce.estado IN ('PENDIENTE', 'PARCIAL')
           AND ce.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
           AND ec.estado_venta <> 'ANULADA'
           ${proyectoId ? Prisma.sql`AND ec.proyecto_id = ${proyectoId}::uuid` : Prisma.empty}
         ORDER BY ce.fecha_vencimiento
         LIMIT 50
      `,

      this.prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT venta_id, venta_numero, cliente_nombre, cliente_documento,
               lote_codigo, proyecto_nombre, saldo, total_en_mora, dias_mora_maximo
          FROM venta_estado_cuenta
         WHERE estado_cartera = 'EN_MORA'
           ${proyectoId ? Prisma.sql`AND proyecto_id = ${proyectoId}::uuid` : Prisma.empty}
         ORDER BY dias_mora_maximo DESC NULLS LAST
         LIMIT 50
      `,
    ]);

    void filtroProyecto;

    return {
      inventario: inventario.map((i) => ({
        estado: i.estado,
        cantidad: Number(i.cantidad),
        valor: i.valor,
        area: i.area,
      })),
      cartera: { ...cartera[0], ventas: Number(cartera[0]?.ventas ?? 0) },
      recaudoMensual: recaudoMensual.map((r) => ({ ...r, pagos: Number(r.pagos) })),
      proximosVencimientos,
      mora,
    };
  }

  /** Cartera detallada por venta a una fecha de corte. */
  carteraDetallada(filtro: Filtro) {
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT venta_numero, proyecto_nombre, lote_codigo, area_m2,
             cliente_documento, cliente_nombre, fecha_venta,
             precio_negociado, total_pagado, saldo, porcentaje_pagado,
             estado_cartera, total_en_mora, dias_mora_maximo, ultimo_pago
        FROM venta_estado_cuenta
       WHERE estado_venta <> 'ANULADA'
         ${filtro.proyectoId ? Prisma.sql`AND proyecto_id = ${filtro.proyectoId}::uuid` : Prisma.empty}
       ORDER BY proyecto_nombre, lote_codigo
    `;
  }

  /** Recaudo por periodo, desglosado por metodo de pago. */
  recaudo(filtro: Filtro) {
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT p.fecha, p.metodo::text AS metodo, p.tipo::text AS tipo,
             p.referencia, p.monto,
             v.numero AS venta_numero, l.codigo AS lote_codigo,
             pr.nombre AS proyecto_nombre,
             c.documento AS cliente_documento, c.nombre AS cliente_nombre,
             u.nombre AS registrado_por
        FROM pagos p
        JOIN ventas v    ON v.id = p.venta_id
        JOIN lotes l     ON l.id = v.lote_id
        JOIN proyectos pr ON pr.id = l.proyecto_id
        JOIN clientes c  ON c.id = v.cliente_id
        JOIN usuarios u  ON u.id = p.registrado_por_id
       WHERE p.anulado = FALSE
         ${filtro.desde ? Prisma.sql`AND p.fecha >= ${filtro.desde}` : Prisma.empty}
         ${filtro.hasta ? Prisma.sql`AND p.fecha <= ${filtro.hasta}` : Prisma.empty}
         ${filtro.proyectoId ? Prisma.sql`AND l.proyecto_id = ${filtro.proyectoId}::uuid` : Prisma.empty}
       ORDER BY p.fecha DESC
    `;
  }

  /** Inventario de lotes con su estado y comprador si lo tiene. */
  inventario(filtro: Filtro) {
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT pr.nombre AS proyecto, e.nombre AS etapa, l.codigo,
             l.area_m2, l.precio_lista, l.estado::text AS estado,
             c.nombre AS comprador, v.numero AS venta_numero,
             v.precio_negociado, v.fecha_venta
        FROM lotes l
        JOIN proyectos pr ON pr.id = l.proyecto_id
   LEFT JOIN etapas e    ON e.id = l.etapa_id
   LEFT JOIN ventas v    ON v.lote_id = l.id AND v.estado <> 'ANULADA'
   LEFT JOIN clientes c  ON c.id = v.cliente_id
       WHERE TRUE
         ${filtro.proyectoId ? Prisma.sql`AND l.proyecto_id = ${filtro.proyectoId}::uuid` : Prisma.empty}
       ORDER BY pr.nombre, l.codigo
    `;
  }

  /** Proyeccion de cobros por mes a futuro. */
  proyeccionCobros(filtro: Filtro) {
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT to_char(date_trunc('month', ce.fecha_vencimiento), 'YYYY-MM') AS mes,
             count(*) AS cuotas,
             sum(ce.monto_pendiente) AS por_cobrar
        FROM cuota_estado ce
        JOIN venta_estado_cuenta ec ON ec.venta_id = ce.venta_id
       WHERE ce.monto_pendiente > 0
         AND ec.estado_venta <> 'ANULADA'
         ${filtro.proyectoId ? Prisma.sql`AND ec.proyecto_id = ${filtro.proyectoId}::uuid` : Prisma.empty}
       GROUP BY 1 ORDER BY 1
    `;
  }

  /** Auditoria: quien hizo que y cuando. */
  auditoria(filtro: { entidad?: string; usuarioId?: string; desde?: Date; limite: number }) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(filtro.entidad ? { entidad: filtro.entidad } : {}),
        ...(filtro.usuarioId ? { usuarioId: filtro.usuarioId } : {}),
        ...(filtro.desde ? { creadoEn: { gte: filtro.desde } } : {}),
      },
      orderBy: { creadoEn: 'desc' },
      take: filtro.limite,
      include: { usuario: { select: { nombre: true, email: true, rol: true } } },
    });
  }

  /**
   * Convierte cualquier reporte a CSV con separador punto y coma, que es
   * lo que Excel en configuracion regional colombiana espera.
   */
  aCsv(filas: Array<Record<string, unknown>>): string {
    if (filas.length === 0) return '';

    const columnas = Object.keys(filas[0]!);
    const escapar = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      // Los montos salen con coma decimal y separador de miles, para que
      // Excel los reconozca como numero sin reformatear.
      if (typeof v === 'object' && 'toFixed' in (v as object)) {
        return formatearCifra(String(v));
      }
      const texto = String(v);
      return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    };

    return [
      // BOM para que Excel detecte UTF-8 y muestre bien las tildes.
      '﻿' + columnas.join(';'),
      ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(';')),
    ].join('\r\n');
  }
}
