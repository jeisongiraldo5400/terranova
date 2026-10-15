import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Permiso } from '@terranova/shared';
import type { UsuarioActual } from './tipos.js';

export const CLAVE_PUBLICO = 'esPublico';
export const CLAVE_PERMISOS = 'permisosRequeridos';

/** Marca una ruta como accesible sin autenticacion (login, health). */
export const Publico = (): MethodDecorator & ClassDecorator =>
  SetMetadata(CLAVE_PUBLICO, true);

/**
 * Exige uno o mas permisos de la matriz de @terranova/shared.
 * El rol no se menciona aqui: la correspondencia rol -> permisos vive en
 * un solo lugar, de modo que cambiarla no implica tocar los controladores.
 */
export const Requiere = (...permisos: Permiso[]): MethodDecorator & ClassDecorator =>
  SetMetadata(CLAVE_PERMISOS, permisos);

/** Inyecta el usuario autenticado en el metodo del controlador. */
export const Actual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): UsuarioActual => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.usuario) {
      throw new Error('Actual() usado en una ruta sin autenticacion');
    }
    return req.usuario;
  },
);
