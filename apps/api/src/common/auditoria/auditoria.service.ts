import { Injectable } from '@nestjs/common';
import type { Prisma } from '@terranova/db';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UsuarioActual } from '../auth/tipos.js';

export interface EntradaAuditoria {
  usuario: UsuarioActual | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  antes?: unknown;
  despues?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Registro de auditoria.
 *
 * El v0 no tenia ninguno: cuando un pago desaparecia del localStorage no
 * habia forma de saber quien lo habia borrado ni cuando. Toda operacion
 * que mueve dinero o cambia un estado escribe aqui.
 *
 * Acepta un cliente de transaccion para que el registro se confirme o se
 * revierta junto con la operacion que describe.
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(
    entrada: EntradaAuditoria,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const cliente = tx ?? this.prisma;

    await cliente.auditLog.create({
      data: {
        usuarioId: entrada.usuario?.id ?? null,
        accion: entrada.accion,
        entidad: entrada.entidad,
        entidadId: entrada.entidadId ?? null,
        antes: this.aJson(entrada.antes),
        despues: this.aJson(entrada.despues),
        ip: entrada.ip ?? null,
        userAgent: entrada.userAgent?.slice(0, 300) ?? null,
      },
    });
  }

  /** Decimal y Date deben quedar legibles dentro del JSONB. */
  private aJson(valor: unknown): Prisma.InputJsonValue | undefined {
    if (valor === undefined || valor === null) return undefined;
    return JSON.parse(
      JSON.stringify(valor, (_k, v) =>
        typeof v === 'bigint' ? Number(v) : (v as unknown),
      ),
    ) as Prisma.InputJsonValue;
  }
}
