/* ==========================================================================
   Puente entre Prisma.Decimal y el Dinero del dominio
   --------------------------------------------------------------------------
   Prisma devuelve NUMERIC(14,2) como Prisma.Decimal, que es decimal.js. El
   dominio usa decimal.js directamente. La conversion es exacta en ambos
   sentidos: en ningun punto aparece un float.
   ========================================================================== */

import { Prisma } from '../generated/client/index.js';
import { type Dinero, type DineroEntrada, aTexto, dinero } from '@terranova/shared';

/** Prisma.Decimal -> Dinero del dominio. */
export const aDinero = (v: Prisma.Decimal | string | number): Dinero => dinero(v.toString());

/** Dinero del dominio -> valor que Prisma escribe en NUMERIC(14,2). */
export const aPrismaDecimal = (v: DineroEntrada): Prisma.Decimal =>
  new Prisma.Decimal(aTexto(v));

/** Para respuestas JSON de la API: siempre string, nunca number. */
export const aJson = (v: Prisma.Decimal | string | number): string => aDinero(v).toFixed(2);
