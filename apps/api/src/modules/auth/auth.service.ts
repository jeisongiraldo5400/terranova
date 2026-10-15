import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { LoginInput, Rol } from '@terranova/shared';
import { PERMISOS_POR_ROL, modulosVisibles } from '@terranova/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditoriaService } from '../../common/auditoria/auditoria.service.js';
import type { PayloadJwt } from '../../common/auth/tipos.js';

export interface ResultadoLogin {
  acceso: string;
  refresco: string;
  usuario: {
    id: string;
    email: string;
    nombre: string;
    rol: Rol;
    permisos: readonly string[];
    modulos: string[];
  };
}

/**
 * Parametros argon2id siguiendo la recomendacion de OWASP (19 MiB, 2
 * iteraciones). Sustituye la comparacion en texto plano del v0.
 */
const OPCIONES_ARGON2 = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async login(
    datos: LoginInput,
    contexto: { ip?: string; userAgent?: string },
  ): Promise<ResultadoLogin> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email: datos.email } });

    // Se verifica el hash incluso si el usuario no existe, para que el
    // tiempo de respuesta no revele si el correo esta registrado.
    const hashParaVerificar =
      usuario?.passwordHash ??
      '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$J7bPKFTYBXH7K0TRPdZCxEXk4h3hXKlHxLJQs0rO6Zc';

    const correcta = await argon2.verify(hashParaVerificar, datos.password).catch(() => false);

    if (!usuario || !correcta || !usuario.activo) {
      await this.auditoria.registrar({
        usuario: null,
        accion: 'LOGIN_FALLIDO',
        entidad: 'Usuario',
        entidadId: datos.email,
        ip: contexto.ip,
        userAgent: contexto.userAgent,
      });
      // Mensaje deliberadamente generico: no distingue entre correo
      // inexistente, clave incorrecta y cuenta desactivada.
      throw new UnauthorizedException({ mensaje: 'Correo o contrasena incorrectos.' });
    }

    const payload: PayloadJwt = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      nombre: usuario.nombre,
    };

    const acceso = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.ttlAcceso(),
    });

    const refresco = await this.emitirRefresco(usuario.id, contexto);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    await this.auditoria.registrar({
      usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
      accion: 'LOGIN',
      entidad: 'Usuario',
      entidadId: usuario.id,
      ip: contexto.ip,
      userAgent: contexto.userAgent,
    });

    return {
      acceso,
      refresco,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        permisos: PERMISOS_POR_ROL[usuario.rol],
        modulos: modulosVisibles(usuario.rol),
      },
    };
  }

  /**
   * Refresco con rotacion: cada uso invalida el token anterior. Si un
   * token ya revocado se reutiliza, se revoca toda la familia de sesiones
   * del usuario, porque indica que el token fue robado.
   */
  async refrescar(
    tokenPlano: string,
    contexto: { ip?: string; userAgent?: string },
  ): Promise<ResultadoLogin> {
    const hash = this.hashToken(tokenPlano);
    const guardado = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { usuario: true },
    });

    if (!guardado) {
      throw new UnauthorizedException({ mensaje: 'Sesion no valida. Inicie sesion de nuevo.' });
    }

    if (guardado.revocadoEn) {
      await this.prisma.refreshToken.updateMany({
        where: { usuarioId: guardado.usuarioId, revocadoEn: null },
        data: { revocadoEn: new Date() },
      });
      await this.auditoria.registrar({
        usuario: null,
        accion: 'REFRESCO_REUTILIZADO',
        entidad: 'Usuario',
        entidadId: guardado.usuarioId,
        ip: contexto.ip,
        userAgent: contexto.userAgent,
      });
      throw new UnauthorizedException({
        mensaje: 'Se detecto un uso indebido de la sesion. Vuelva a iniciar sesion.',
      });
    }

    if (guardado.expiraEn < new Date() || !guardado.usuario.activo) {
      throw new UnauthorizedException({ mensaje: 'La sesion expiro. Inicie sesion de nuevo.' });
    }

    await this.prisma.refreshToken.update({
      where: { id: guardado.id },
      data: { revocadoEn: new Date() },
    });

    const u = guardado.usuario;
    const payload: PayloadJwt = { sub: u.id, email: u.email, rol: u.rol, nombre: u.nombre };

    return {
      acceso: await this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.ttlAcceso(),
      }),
      refresco: await this.emitirRefresco(u.id, contexto),
      usuario: {
        id: u.id,
        email: u.email,
        nombre: u.nombre,
        rol: u.rol,
        permisos: PERMISOS_POR_ROL[u.rol],
        modulos: modulosVisibles(u.rol),
      },
    };
  }

  async cerrarSesion(tokenPlano: string | undefined, usuarioId: string): Promise<void> {
    if (tokenPlano) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.hashToken(tokenPlano), revocadoEn: null },
        data: { revocadoEn: new Date() },
      });
    }
    await this.auditoria.registrar({
      usuario: null,
      accion: 'LOGOUT',
      entidad: 'Usuario',
      entidadId: usuarioId,
    });
  }

  private async emitirRefresco(
    usuarioId: string,
    contexto: { ip?: string; userAgent?: string },
  ): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    const dias = Number(this.config.get<string>('JWT_REFRESH_TTL', '7d').replace(/\D/g, '')) || 7;

    await this.prisma.refreshToken.create({
      data: {
        usuarioId,
        // Se guarda solo el hash: una fuga de la tabla no permite
        // reconstruir las sesiones activas.
        tokenHash: this.hashToken(token),
        expiraEn: new Date(Date.now() + dias * 86_400_000),
        ip: contexto.ip ?? null,
        userAgent: contexto.userAgent?.slice(0, 300) ?? null,
      },
    });

    return token;
  }

  private hashToken = (token: string): string =>
    createHash('sha256').update(token).digest('hex');

  /**
   * @nestjs/jwt tipa expiresIn como `number | StringValue` (de la libreria
   * ms), un literal de plantilla que no se puede derivar de un string de
   * configuracion. Se valida el formato aqui y luego se afirma el tipo.
   */
  private ttlAcceso(): number {
    const crudo = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const m = /^(\d+)([smhd])$/.exec(crudo.trim());
    if (!m) {
      throw new Error(`JWT_ACCESS_TTL invalido: "${crudo}". Use por ejemplo 15m, 1h o 7d.`);
    }
    const factor = { s: 1, m: 60, h: 3600, d: 86_400 }[m[2] as 's' | 'm' | 'h' | 'd'];
    return Number(m[1]) * factor;
  }

  static hashearClave = (clave: string): Promise<string> =>
    argon2.hash(clave, OPCIONES_ARGON2);
}
