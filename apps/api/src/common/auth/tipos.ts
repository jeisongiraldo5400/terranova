import type { Rol } from '@terranova/shared';

/** Contenido del access token. */
export interface PayloadJwt {
  sub: string;
  email: string;
  rol: Rol;
  nombre: string;
}

/** Usuario autenticado, adjunto a la peticion por el guard. */
export interface UsuarioActual {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

declare module 'express' {
  interface Request {
    usuario?: UsuarioActual;
  }
}
