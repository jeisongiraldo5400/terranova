import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Valida el cuerpo o la query con un esquema de @terranova/shared.
 *
 * Es la pieza que hace que la regla se escriba una sola vez: el mismo
 * esquema que valida aqui es el resolver del formulario en Next. En el v0
 * las validaciones estaban duplicadas entre pages/ y components/, con
 * logica divergente.
 *
 * Usa safeParse en lugar de parse + `instanceof ZodError`: el esquema llega
 * desde el paquete compartido, que puede cargar su propia copia de zod, y
 * entonces el `instanceof` falla aunque el error SI sea un ZodError. El
 * sintoma era un 500 en lugar de un 400 con los errores por campo.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(valor: unknown, _metadata: ArgumentMetadata): unknown {
    const resultado = this.schema.safeParse(valor);

    if (resultado.success) return resultado.data;

    // Un objeto campo -> mensaje, que el formulario pinta junto a cada input.
    const errores: Record<string, string> = {};
    for (const issue of resultado.error.issues) {
      const campo = issue.path.join('.') || '_';
      errores[campo] ??= issue.message;
    }

    throw new BadRequestException({
      mensaje: 'Los datos enviados no son validos',
      errores,
    });
  }
}

/** Azucar para usarlo en los controladores: `@Body(zodPipe(miSchema))`. */
export const zodPipe = (schema: ZodSchema): ZodValidationPipe =>
  new ZodValidationPipe(schema);
