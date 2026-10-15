import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type Permiso, tieneTodosLosPermisos } from '@terranova/shared';
import { CLAVE_PERMISOS, CLAVE_PUBLICO } from './decoradores.js';
import type { PayloadJwt } from './tipos.js';

/**
 * Autenticacion y autorizacion en un solo guard global.
 *
 * Reemplaza por completo el modelo del v0, donde Login.jsx comparaba
 * `admin`/`1234` en el navegador, guardaba el usuario en localStorage y no
 * existia ninguna verificacion del lado del servidor -- cualquiera podia
 * escribir `localStorage.setItem('usuario', ...)` y entrar.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (esPublico) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const token = this.extraerToken(req);

    if (!token) {
      throw new UnauthorizedException({ mensaje: 'Debe iniciar sesion.' });
    }

    let payload: PayloadJwt;
    try {
      payload = await this.jwt.verifyAsync<PayloadJwt>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        mensaje: 'La sesion expiro o el token no es valido.',
        codigo: 'TOKEN_INVALIDO',
      });
    }

    req.usuario = {
      id: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      rol: payload.rol,
    };

    const requeridos = this.reflector.getAllAndOverride<Permiso[]>(CLAVE_PERMISOS, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (requeridos?.length && !tieneTodosLosPermisos(payload.rol, requeridos)) {
      throw new ForbiddenException({
        mensaje: 'Su rol no tiene permiso para realizar esta accion.',
        codigo: 'SIN_PERMISO',
        detalles: { requeridos, rol: payload.rol },
      });
    }

    return true;
  }

  private extraerToken(req: Request): string | null {
    const cabecera = req.headers.authorization;
    if (cabecera?.startsWith('Bearer ')) return cabecera.slice(7);
    // Alternativa por cookie httpOnly, que es como la usa el frontend.
    const cookie = (req.cookies as Record<string, string> | undefined)?.acceso;
    return cookie ?? null;
  }
}
