/* ==========================================================================
   Cliente de la API
   --------------------------------------------------------------------------
   Desde el navegador, las peticiones pasan por /api/* del propio Next, que
   las reenvia a NestJS (ver app/api/[...ruta]/route.ts). Asi el navegador
   habla siempre con su mismo origen: las cookies httpOnly de sesion viajan
   sin CORS y sin exponer la direccion del backend.

   Desde componentes de servidor se llama a NestJS directamente con
   API_URL: pasar por el proxy seria que Next se llamara a si mismo.
   ========================================================================== */

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    message: string,
    readonly codigo?: string,
    /** Errores por campo, para pintarlos junto a cada input. */
    readonly errores?: Record<string, string>,
    readonly detalles?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ErrorApi';
  }
}

type Opciones = Omit<RequestInit, 'body'> & { body?: unknown; query?: Record<string, unknown> };

async function peticion<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { body, query, headers, ...resto } = opciones;

  // Primero las cookies: leerlas marca la pagina como dinamica, de modo que
  // Next no intenta prerenderizarla en el build, donde no hay sesion.
  const sesion = await cabecerasDeSesion();

  const url = new URL(`/api${ruta}`, baseUrl());
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...resto,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...sesion,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    // Mismo error que devuelve el proxy cuando la API esta caida.
    throw new ErrorApi(
      503,
      'No se pudo conectar con el servidor. Verifique que la API este activa.',
      'SIN_CONEXION',
    );
  }

  if (res.status === 204) return undefined as T;

  const texto = await res.text();
  const datos = texto ? (JSON.parse(texto) as unknown) : null;

  if (!res.ok) {
    const e = (datos ?? {}) as {
      mensaje?: string;
      codigo?: string;
      errores?: Record<string, string>;
      detalles?: Record<string, unknown>;
    };
    throw new ErrorApi(
      res.status,
      e.mensaje ?? 'No se pudo completar la operacion.',
      e.codigo,
      e.errores,
      e.detalles,
    );
  }

  return datos as T;
}

/**
 * En el navegador, el propio origen: el proxy de /api/* reenvia a NestJS.
 * En el servidor no existe el concepto de origen, y la API escucha bajo el
 * mismo prefijo /api, asi que se le habla directamente.
 */
function baseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.API_URL || 'http://localhost:3101';
}

/**
 * En el servidor, fetch no arrastra las cookies del visitante de forma
 * automatica: hay que reenviarlas a mano.
 */
async function cabecerasDeSesion(): Promise<Record<string, string>> {
  if (typeof window !== 'undefined') return {};
  const { cookies } = await import('next/headers');
  const almacen = await cookies();
  const cookie = almacen.toString();
  return cookie ? { cookie } : {};
}

export const api = {
  get: <T>(ruta: string, query?: Record<string, unknown>) =>
    peticion<T>(ruta, { method: 'GET', query }),
  post: <T>(ruta: string, body?: unknown) => peticion<T>(ruta, { method: 'POST', body }),
  put: <T>(ruta: string, body?: unknown) => peticion<T>(ruta, { method: 'PUT', body }),
  patch: <T>(ruta: string, body?: unknown) => peticion<T>(ruta, { method: 'PATCH', body }),
  delete: <T>(ruta: string) => peticion<T>(ruta, { method: 'DELETE' }),
};
