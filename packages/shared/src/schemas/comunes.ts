/* ==========================================================================
   Primitivas de validacion compartidas
   --------------------------------------------------------------------------
   Estos esquemas se usan como DTO en Nest (via ZodValidationPipe) y como
   resolver de React Hook Form en Next. Una regla escrita aqui se cumple en
   el cliente y en el servidor, lo que elimina la clase de bugs del v0 donde
   `pages/` y `components/` validaban distinto.
   ========================================================================== */

import { z } from 'zod';
import { dinero, dineroDesdeTexto } from '../domain/dinero.js';
import { AREA_MINIMA_M2_POR_DEFECTO, normalizarDocumento } from '../domain/reglas.js';

export const idSchema = z.string().uuid('Identificador invalido');

/**
 * Dinero. Un numero se toma tal cual; un string se interpreta en convencion
 * colombiana ("85.000.000,50"), que es lo que escribe la persona en el
 * formulario. Siempre sale como string canonico "0.00", apto para JSON y
 * para NUMERIC(14,2) en Postgres.
 */
export const dineroSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    try {
      return (typeof v === 'string' ? dineroDesdeTexto(v) : dinero(v)).toFixed(2);
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: e instanceof Error ? e.message : 'Valor monetario invalido',
      });
      return z.NEVER;
    }
  });

export const dineroPositivoSchema = dineroSchema.refine(
  (v) => Number(v) > 0,
  'El valor debe ser mayor que cero',
);

export const dineroNoNegativoSchema = dineroSchema.refine(
  (v) => Number(v) >= 0,
  'El valor no puede ser negativo',
);

/**
 * Fecha sin hora. Las fechas del negocio (venta, pago, vencimiento) son
 * dias calendario, no instantes: en Postgres son @db.Date.
 *
 * La normalizacion es en UTC, NO en hora local. Con setHours() local, la
 * cadena "2026-09-01" --que se parsea como medianoche UTC-- retrocedia al
 * 31 de agosto en cualquier zona con desplazamiento negativo, y Colombia
 * es UTC-5. Una venta del 1 de septiembre quedaba fechada el 31 de agosto
 * y el plan de pagos heredaba el corrimiento.
 */
export const fechaSchema = z.coerce
  .date({ invalid_type_error: 'Fecha invalida' })
  .transform((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));

export const fechaNoFuturaSchema = fechaSchema.refine(
  (d) => d <= finDelDiaUtc(new Date()),
  'La fecha no puede ser futura',
);

/** Ultimo instante del dia calendario UTC. */
function finDelDiaUtc(f: Date): Date {
  return new Date(
    Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate(), 23, 59, 59, 999),
  );
}

export const areaM2Schema = z.coerce
  .number({ invalid_type_error: 'El area debe ser un numero' })
  .positive('El area debe ser mayor que cero')
  .max(1_000_000, 'El area excede el maximo razonable')
  .refine(
    (v) => v >= AREA_MINIMA_M2_POR_DEFECTO,
    `El area minima permitida es de ${AREA_MINIMA_M2_POR_DEFECTO} m2`,
  );

export const documentoSchema = z
  .string()
  .trim()
  .min(6, 'El documento es demasiado corto')
  .transform(normalizarDocumento)
  .refine((v) => /^\d{6,15}$/.test(v), 'El documento debe contener entre 6 y 15 digitos');

export const telefonoSchema = z
  .string()
  .trim()
  .regex(/^[\d\s()+-]{7,20}$/, 'Numero de telefono invalido');

export const emailSchema = z.string().trim().toLowerCase().email('Correo electronico invalido');

export const nombreSchema = z
  .string()
  .trim()
  .min(3, 'Debe tener al menos 3 caracteres')
  .max(120, 'Maximo 120 caracteres');

/** Codigos de lote y proyecto: mayusculas, sin espacios. "mz-a 01" -> "MZ-A01" */
export const codigoSchema = z
  .string()
  .trim()
  .min(1, 'El codigo es obligatorio')
  .max(30, 'Maximo 30 caracteres')
  .transform((v) => v.toUpperCase().replace(/\s+/g, ''))
  .refine((v) => /^[A-Z0-9-]+$/.test(v), 'Solo letras, numeros y guiones');

export const motivoSchema = z
  .string()
  .trim()
  .min(10, 'El motivo debe tener al menos 10 caracteres')
  .max(500, 'Maximo 500 caracteres');

export const observacionesSchema = z.string().trim().max(1000).optional().nullable();

/* --- Paginacion y ordenamiento ------------------------------------------- */

export const paginacionSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(25),
});
export type Paginacion = z.infer<typeof paginacionSchema>;

export const ordenSchema = z.object({
  ordenarPor: z.string().optional(),
  direccion: z.enum(['asc', 'desc']).default('asc'),
});

export interface Pagina<T> {
  readonly datos: readonly T[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
  readonly totalPaginas: number;
}
