/* ==========================================================================
   Proxy hacia la API de NestJS
   --------------------------------------------------------------------------
   El navegador siempre habla con su propio origen (localhost:3000) y Next
   reenvia a NestJS. Dos ventajas concretas:

     - Las cookies httpOnly de sesion viajan sin configurar CORS ni
       SameSite=None, y nunca quedan expuestas a JavaScript.
     - La direccion del backend no se publica al cliente: solo existe en
       variables de entorno del servidor.
   ========================================================================== */

import { type NextRequest, NextResponse } from 'next/server';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3101';

// Cabeceras que no deben reenviarse: las gestiona cada salto por separado.
const PROHIBIDAS = new Set([
  'host', 'connection', 'content-length', 'transfer-encoding',
  'keep-alive', 'upgrade', 'accept-encoding',
]);

async function reenviar(req: NextRequest, ruta: string[]): Promise<Response> {
  const destino = new URL(`/api/${ruta.join('/')}`, API);
  destino.search = req.nextUrl.search;

  const cabeceras = new Headers();
  req.headers.forEach((valor, clave) => {
    if (!PROHIBIDAS.has(clave.toLowerCase())) cabeceras.set(clave, valor);
  });

  const cuerpo =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();

  let respuesta: Response;
  try {
    respuesta = await fetch(destino, {
      method: req.method,
      headers: cabeceras,
      body: cuerpo,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    // El backend esta caido: se responde con el mismo formato de error que
    // usa la API, para que la interfaz no tenga que distinguir el caso.
    return NextResponse.json(
      {
        mensaje: 'No se pudo conectar con el servidor. Verifique que la API este activa.',
        codigo: 'SIN_CONEXION',
      },
      { status: 503 },
    );
  }

  const salida = new Headers();
  respuesta.headers.forEach((valor, clave) => {
    // set-cookie se copia aparte: puede venir repetida y Headers.set la
    // colapsaria, perdiendo el token de refresco.
    if (clave.toLowerCase() !== 'set-cookie') salida.set(clave, valor);
  });
  for (const cookie of respuesta.headers.getSetCookie()) {
    salida.append('set-cookie', cookie);
  }

  return new NextResponse(respuesta.body, { status: respuesta.status, headers: salida });
}

type Contexto = { params: Promise<{ ruta: string[] }> };

export async function GET(req: NextRequest, { params }: Contexto) {
  return reenviar(req, (await params).ruta);
}
export async function POST(req: NextRequest, { params }: Contexto) {
  return reenviar(req, (await params).ruta);
}
export async function PUT(req: NextRequest, { params }: Contexto) {
  return reenviar(req, (await params).ruta);
}
export async function PATCH(req: NextRequest, { params }: Contexto) {
  return reenviar(req, (await params).ruta);
}
export async function DELETE(req: NextRequest, { params }: Contexto) {
  return reenviar(req, (await params).ruta);
}
