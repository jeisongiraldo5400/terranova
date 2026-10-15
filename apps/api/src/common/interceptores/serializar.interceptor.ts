import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { Prisma } from '@terranova/db';

/**
 * Serializa la respuesta de forma segura para JSON.
 *
 *   - Prisma.Decimal -> string ("85000000.00"), NUNCA number. Convertirlo a
 *     number reintroduciria el punto flotante que todo el sistema evita.
 *   - BigInt (los COUNT de Postgres) -> number.
 *   - Date -> "YYYY-MM-DD" cuando es una fecha de negocio sin hora.
 */
@Injectable()
export class SerializarInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((datos) => normalizar(datos)));
  }
}

function normalizar(valor: unknown): unknown {
  if (valor === null || valor === undefined) return valor;

  // Los binarios pasan intactos. Un Buffer es un objeto, de modo que el
  // recorrido generico de abajo lo convertiria en {"0":37,"1":80,...} y
  // destrozaria la descarga del PDF del contrato.
  if (Buffer.isBuffer(valor) || valor instanceof Uint8Array) return valor;

  // Lo mismo para streams y cualquier cosa que Nest ya sepa enviar.
  if (typeof (valor as { pipe?: unknown }).pipe === 'function') return valor;

  if (Prisma.Decimal.isDecimal(valor)) return valor.toFixed(2);
  if (typeof valor === 'bigint') return Number(valor);

  if (valor instanceof Date) {
    // Medianoche UTC exacta => es una fecha de negocio (@db.Date), no un
    // instante. Se devuelve como dia para que no se corra de zona horaria.
    const esFechaPura =
      valor.getUTCHours() === 0 &&
      valor.getUTCMinutes() === 0 &&
      valor.getUTCSeconds() === 0 &&
      valor.getUTCMilliseconds() === 0;
    return esFechaPura ? valor.toISOString().slice(0, 10) : valor.toISOString();
  }

  if (Array.isArray(valor)) return valor.map(normalizar);

  if (typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) salida[k] = normalizar(v);
    return salida;
  }

  return valor;
}
