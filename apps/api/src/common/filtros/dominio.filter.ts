import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ErrorDominio } from '@terranova/shared';
import { Prisma } from '@terranova/db';

/**
 * Traduce los errores del dominio y de Prisma a respuestas HTTP.
 *
 * El dominio (packages/shared) no conoce HTTP a proposito: lanza
 * ErrorReglaNegocio, ErrorTransicion, etc. Esta es la unica frontera donde
 * eso se convierte en un codigo de estado, de modo que la misma regla
 * funciona igual en la API, en los tests y en el importador de datos.
 */
@Catch()
export class DominioExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DominioExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    // --- Errores de dominio ---------------------------------------------
    if (error instanceof ErrorDominio) {
      const estado = {
        REGLA_NEGOCIO: HttpStatus.UNPROCESSABLE_ENTITY,
        TRANSICION_INVALIDA: HttpStatus.CONFLICT,
        NO_ENCONTRADO: HttpStatus.NOT_FOUND,
        CONFLICTO: HttpStatus.CONFLICT,
        SIN_PERMISO: HttpStatus.FORBIDDEN,
      }[error.codigo];

      res.status(estado).json({
        mensaje: error.message,
        codigo: error.codigo,
        detalles: error.detalles,
      });
      return;
    }

    // --- Violaciones de integridad de Postgres --------------------------
    // Las invariantes de la base son la ultima linea de defensa; cuando
    // una se dispara hay que devolver un mensaje util, no un 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const traducido = this.traducirPrisma(error);
      if (traducido) {
        res.status(traducido.estado).json({ mensaje: traducido.mensaje, codigo: 'CONFLICTO' });
        return;
      }
    }

    // Errores lanzados por los triggers plpgsql (RAISE EXCEPTION).
    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      const mensaje = this.extraerMensajeDeTrigger(error.message);
      if (mensaje) {
        res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
          mensaje,
          codigo: 'REGLA_NEGOCIO',
        });
        return;
      }
    }

    // --- Excepciones propias de Nest ------------------------------------
    if (error instanceof HttpException) {
      const cuerpo = error.getResponse();
      res
        .status(error.getStatus())
        .json(typeof cuerpo === 'string' ? { mensaje: cuerpo } : cuerpo);
      return;
    }

    // --- Lo inesperado --------------------------------------------------
    this.logger.error(
      `Error no controlado (${error?.constructor?.name ?? typeof error})`,
      error instanceof Error ? error.stack : JSON.stringify(error).slice(0, 2000),
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      mensaje: 'Ocurrio un error inesperado. Intente de nuevo.',
      codigo: 'ERROR_INTERNO',
    });
  }

  private traducirPrisma(
    e: Prisma.PrismaClientKnownRequestError,
  ): { estado: HttpStatus; mensaje: string } | null {
    const destino = Array.isArray(e.meta?.target)
      ? (e.meta.target as string[]).join(', ')
      : String(e.meta?.target ?? '');

    switch (e.code) {
      case 'P2002': {
        // Indice unico. Los mensajes se nombran por el constraint para que
        // el usuario lea algo accionable.
        const porConstraint: Record<string, string> = {
          uniq_venta_vigente_por_lote:
            'Este lote ya tiene una venta vigente. Anule la venta anterior antes de volver a venderlo.',
          clientes_documento_key: 'Ya existe un cliente registrado con ese documento.',
          lotes_proyecto_id_codigo_key: 'Ya existe un lote con ese codigo en el proyecto.',
          proyectos_codigo_key: 'Ya existe un proyecto con ese codigo.',
          usuarios_email_key: 'Ya existe un usuario con ese correo.',
          ventas_numero_key: 'Conflicto al asignar el numero de venta. Intente de nuevo.',
          contratos_numero_version_key:
            'Ya existe esa version del contrato. Intente regenerar de nuevo.',
          contratos_venta_id_version_key:
            'Ya existe esa version del contrato para la venta.',
        };
        return {
          estado: HttpStatus.CONFLICT,
          mensaje:
            porConstraint[destino] ?? `Ya existe un registro con el mismo valor en: ${destino}.`,
        };
      }
      case 'P2003':
        return {
          estado: HttpStatus.CONFLICT,
          mensaje: 'La operacion viola una referencia entre registros.',
        };
      case 'P2025':
        return { estado: HttpStatus.NOT_FOUND, mensaje: 'El registro no existe.' };
      case 'P2014':
      case 'P2011':
        return {
          estado: HttpStatus.UNPROCESSABLE_ENTITY,
          mensaje: 'Faltan datos obligatorios para completar la operacion.',
        };
      default:
        return null;
    }
  }

  /**
   * Los triggers de prisma/sql/01-invariantes.sql levantan mensajes
   * redactados en espanol y listos para mostrar. Se extraen del texto que
   * envuelve Prisma.
   */
  private extraerMensajeDeTrigger(texto: string): string | null {
    const patrones = [
      /El area del lote \([^)]*\) es menor que el minimo del proyecto \([^)]*\)/,
      /El pago \([^)]*\) no puede ser anterior a la fecha de venta \([^)]*\)/,
      /El pago excede el saldo pendiente\.[^\n"]*/,
      /Las cuotas del plan suman [^\n"]*/,
    ];
    for (const p of patrones) {
      const m = texto.match(p);
      if (m) return m[0];
    }
    return null;
  }
}
