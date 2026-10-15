import { redirect } from 'next/navigation';
import { api, ErrorApi } from './api';
import type { UsuarioSesion } from './tipos';

/** Usuario actual, o null si no hay sesion. Para componentes de servidor. */
export async function sesionActual(): Promise<UsuarioSesion | null> {
  try {
    return await api.get<UsuarioSesion>('/auth/yo');
  } catch (e) {
    if (e instanceof ErrorApi && (e.estado === 401 || e.estado === 403)) return null;
    throw e;
  }
}

/** Exige sesion; si no la hay, manda al login. */
export async function exigirSesion(): Promise<UsuarioSesion> {
  const usuario = await sesionActual();
  if (!usuario) redirect('/login');
  return usuario;
}
