import { Injectable } from '@nestjs/common';
import {
  type CrearUsuarioInput,
  ErrorNoEncontrado,
  ErrorReglaNegocio,
} from '@terranova/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditoriaService } from '../../common/auditoria/auditoria.service.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';
import { AuthService } from '../auth/auth.service.js';

const SIN_HASH = {
  id: true, email: true, nombre: true, rol: true, activo: true,
  ultimoAcceso: true, creadoEn: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** El hash nunca sale del servidor. */
  listar() {
    return this.prisma.usuario.findMany({ select: SIN_HASH, orderBy: { nombre: 'asc' } });
  }

  async crear(datos: CrearUsuarioInput, usuario: UsuarioActual) {
    const creado = await this.prisma.usuario.create({
      data: {
        email: datos.email,
        nombre: datos.nombre,
        rol: datos.rol,
        passwordHash: await AuthService.hashearClave(datos.password),
      },
      select: SIN_HASH,
    });

    await this.auditoria.registrar({
      usuario,
      accion: 'USUARIO_CREADO',
      entidad: 'Usuario',
      entidadId: creado.id,
      despues: { email: creado.email, rol: creado.rol },
    });

    return creado;
  }

  async cambiarRol(id: string, rol: CrearUsuarioInput['rol'], usuario: UsuarioActual) {
    const antes = await this.prisma.usuario.findUnique({ where: { id } });
    if (!antes) throw new ErrorNoEncontrado('Usuario', id);

    // No se puede quedar el sistema sin ningun administrador activo.
    if (antes.rol === 'ADMIN' && rol !== 'ADMIN') {
      const otrosAdmins = await this.prisma.usuario.count({
        where: { rol: 'ADMIN', activo: true, id: { not: id } },
      });
      if (otrosAdmins === 0) {
        throw new ErrorReglaNegocio(
          'No se puede cambiar el rol del unico administrador activo.',
        );
      }
    }

    const actualizado = await this.prisma.usuario.update({
      where: { id },
      data: { rol },
      select: SIN_HASH,
    });

    await this.auditoria.registrar({
      usuario,
      accion: 'USUARIO_ROL_CAMBIADO',
      entidad: 'Usuario',
      entidadId: id,
      antes: { rol: antes.rol },
      despues: { rol },
    });

    return actualizado;
  }

  async cambiarEstado(id: string, activo: boolean, usuario: UsuarioActual) {
    if (!activo) {
      if (id === usuario.id) {
        throw new ErrorReglaNegocio('No puede desactivar su propia cuenta.');
      }
      const objetivo = await this.prisma.usuario.findUnique({ where: { id } });
      if (objetivo?.rol === 'ADMIN') {
        const otrosAdmins = await this.prisma.usuario.count({
          where: { rol: 'ADMIN', activo: true, id: { not: id } },
        });
        if (otrosAdmins === 0) {
          throw new ErrorReglaNegocio('No se puede desactivar al unico administrador activo.');
        }
      }
    }

    const actualizado = await this.prisma.usuario.update({
      where: { id },
      data: { activo },
      select: SIN_HASH,
    });

    // Al desactivar se revocan todas sus sesiones abiertas.
    if (!activo) {
      await this.prisma.refreshToken.updateMany({
        where: { usuarioId: id, revocadoEn: null },
        data: { revocadoEn: new Date() },
      });
    }

    await this.auditoria.registrar({
      usuario,
      accion: activo ? 'USUARIO_ACTIVADO' : 'USUARIO_DESACTIVADO',
      entidad: 'Usuario',
      entidadId: id,
    });

    return actualizado;
  }

  async restablecerClave(id: string, nueva: string, usuario: UsuarioActual): Promise<void> {
    await this.prisma.usuario.update({
      where: { id },
      data: { passwordHash: await AuthService.hashearClave(nueva) },
    });

    await this.prisma.refreshToken.updateMany({
      where: { usuarioId: id, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });

    await this.auditoria.registrar({
      usuario,
      accion: 'USUARIO_CLAVE_RESTABLECIDA',
      entidad: 'Usuario',
      entidadId: id,
    });
  }
}
