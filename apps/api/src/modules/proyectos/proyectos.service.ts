import { Injectable } from '@nestjs/common';
import { Prisma, type ProyectoResumenRow } from '@terranova/db';
import {
  type CrearProyectoInput,
  ErrorNoEncontrado,
  ErrorReglaNegocio,
} from '@terranova/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditoriaService } from '../../common/auditoria/auditoria.service.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';

@Injectable()
export class ProyectosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Lista con los agregados de cartera resueltos por la vista SQL. */
  listar(): Promise<ProyectoResumenRow[]> {
    return this.prisma.$queryRaw<ProyectoResumenRow[]>`
      SELECT * FROM proyecto_resumen ORDER BY nombre
    `;
  }

  async obtener(id: string) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id },
      include: {
        etapas: { orderBy: { numero: 'asc' }, include: { _count: { select: { lotes: true } } } },
      },
    });
    if (!proyecto) throw new ErrorNoEncontrado('Proyecto', id);

    const [resumen] = await this.prisma.$queryRaw<ProyectoResumenRow[]>`
      SELECT * FROM proyecto_resumen WHERE proyecto_id = ${id}::uuid
    `;

    return { ...proyecto, resumen };
  }

  async crear(datos: CrearProyectoInput, usuario: UsuarioActual) {
    const proyecto = await this.prisma.proyecto.create({
      data: {
        codigo: datos.codigo,
        nombre: datos.nombre,
        ubicacion: datos.ubicacion ?? null,
        estado: datos.estado,
        areaMinimaM2: new Prisma.Decimal(String(datos.areaMinimaM2)),
        observaciones: datos.observaciones ?? null,
      },
    });

    await this.auditoria.registrar({
      usuario,
      accion: 'PROYECTO_CREADO',
      entidad: 'Proyecto',
      entidadId: proyecto.id,
      despues: { codigo: proyecto.codigo, nombre: proyecto.nombre },
    });

    return proyecto;
  }

  async actualizar(id: string, datos: Partial<CrearProyectoInput>, usuario: UsuarioActual) {
    const antes = await this.prisma.proyecto.findUnique({ where: { id } });
    if (!antes) throw new ErrorNoEncontrado('Proyecto', id);

    // Subir el area minima no puede dejar lotes existentes en infraccion.
    if (datos.areaMinimaM2 !== undefined) {
      const nuevoMinimo = new Prisma.Decimal(String(datos.areaMinimaM2));
      const enInfraccion = await this.prisma.lote.count({
        where: { proyectoId: id, areaM2: { lt: nuevoMinimo } },
      });
      if (enInfraccion > 0) {
        throw new ErrorReglaNegocio(
          `No se puede subir el area minima a ${datos.areaMinimaM2} m2: ` +
            `${enInfraccion} lote(s) existente(s) quedarian por debajo.`,
          { lotesEnInfraccion: enInfraccion },
        );
      }
    }

    const proyecto = await this.prisma.proyecto.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
        ...(datos.ubicacion !== undefined ? { ubicacion: datos.ubicacion } : {}),
        ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
        ...(datos.areaMinimaM2 !== undefined
          ? { areaMinimaM2: new Prisma.Decimal(String(datos.areaMinimaM2)) }
          : {}),
        ...(datos.observaciones !== undefined ? { observaciones: datos.observaciones } : {}),
      },
    });

    await this.auditoria.registrar({
      usuario,
      accion: 'PROYECTO_ACTUALIZADO',
      entidad: 'Proyecto',
      entidadId: id,
      antes: { nombre: antes.nombre, estado: antes.estado, areaMinimaM2: antes.areaMinimaM2.toFixed(2) },
      despues: datos,
    });

    return proyecto;
  }

  async crearEtapa(datos: { proyectoId: string; numero: number; nombre: string }) {
    const proyecto = await this.prisma.proyecto.findUnique({ where: { id: datos.proyectoId } });
    if (!proyecto) throw new ErrorNoEncontrado('Proyecto', datos.proyectoId);
    return this.prisma.etapa.create({ data: datos });
  }

  /** Un proyecto con lotes vendidos no se elimina: se cierra. */
  async eliminar(id: string, usuario: UsuarioActual): Promise<void> {
    const comprometidos = await this.prisma.lote.count({
      where: { proyectoId: id, estado: { in: ['VENDIDO', 'PAGADO', 'RESERVADO'] } },
    });

    if (comprometidos > 0) {
      throw new ErrorReglaNegocio(
        `No se puede eliminar el proyecto: tiene ${comprometidos} lote(s) con compromiso. ` +
          'Puede cerrarlo cambiando su estado a CERRADO.',
        { lotesComprometidos: comprometidos },
      );
    }

    await this.prisma.proyecto.delete({ where: { id } });
    await this.auditoria.registrar({
      usuario,
      accion: 'PROYECTO_ELIMINADO',
      entidad: 'Proyecto',
      entidadId: id,
    });
  }
}
