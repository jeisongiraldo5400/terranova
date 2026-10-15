/* ==========================================================================
   Dinero
   --------------------------------------------------------------------------
   El bug mas costoso del sistema v0 vivia en Pagos.jsx:433

       const saldo = precio - pagado;
       if (saldo === 0) return 'PAGADO';

   Con numeros de punto flotante ese `=== 0` falla. Un lote de 85.000.000 con
   tres abonos de 28.333.333,33 deja un residuo de 1e-8 y la venta nunca se
   marca como pagada: el lote queda en VENDIDO para siempre y la cartera
   reporta un saldo fantasma.

   Todo el dinero del sistema pasa por este modulo. Internamente es Decimal
   (aritmetica decimal exacta) y en Postgres es NUMERIC(14,2). En ningun punto
   del recorrido existe un `number` de punto flotante.
   ========================================================================== */

import { Decimal } from 'decimal.js';

// 2 decimales, redondeo al par mas cercano (norma contable) y suficiente
// precision para el valor total de un proyecto completo.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN, toExpNeg: -9, toExpPos: 21 });

export type Dinero = Decimal;

/** Entrada aceptada: lo que puede llegar de un formulario, de la API o de Prisma. */
export type DineroEntrada = string | number | Decimal | { toString(): string };

export const CERO: Dinero = new Decimal(0);

/**
 * Construye un valor monetario, cuantizado a 2 decimales.
 *
 * Es ESTRICTA a proposito: acepta solo formato canonico, donde el punto es
 * el separador decimal ("85000000.50"). No intenta adivinar separadores de
 * miles porque el formato colombiano es ambiguo: "10.005" puede ser diez
 * mil cinco o diez con cinco milesimas, y no hay forma de distinguirlos.
 *
 * Para texto escrito por una persona use `dineroDesdeTexto`, que declara
 * explicitamente la convencion colombiana.
 */
export function dinero(valor: DineroEntrada): Dinero {
  if (valor instanceof Decimal) return valor.toDecimalPlaces(2);

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) {
      throw new RangeError(`Valor monetario no finito: ${valor}`);
    }
    return new Decimal(valor).toDecimalPlaces(2);
  }

  const texto = String(valor).trim();
  if (texto === '') return CERO;

  if (!/^-?\d+(\.\d+)?$/.test(texto)) {
    throw new RangeError(
      `Valor monetario invalido: "${texto}". ` +
        'Se espera formato canonico (ej. "85000000.50"); para entrada con ' +
        'separadores de miles use dineroDesdeTexto().',
    );
  }

  return new Decimal(texto).toDecimalPlaces(2);
}

/**
 * Interpreta dinero escrito por una persona en convencion colombiana:
 * el punto agrupa miles y la coma separa decimales.
 *
 *   "85.000.000"     -> 85000000.00
 *   "85.000.000,50"  -> 85000000.50
 *   "$ 1.500"        -> 1500.00
 *   "1500"           -> 1500.00
 *   "1500,75"        -> 1500.75
 *
 * Esta es la funcion que usan los formularios. Al ser una entrada distinta
 * de `dinero()`, la ambiguedad desaparece: aqui "10.005" es diez mil cinco
 * sin lugar a duda, porque la convencion esta declarada.
 */
export function dineroDesdeTexto(texto: string): Dinero {
  const limpio = texto.trim().replace(/[^\d.,-]/g, '');
  if (limpio === '' || limpio === '-') {
    throw new RangeError(`Valor monetario invalido: "${texto}"`);
  }

  const negativo = limpio.startsWith('-');
  const sinSigno = limpio.replace(/-/g, '');

  // Un unico punto seguido de 1 o 2 digitos NO puede ser separador de
  // miles: los grupos de millar llevan siempre tres cifras. Ese caso se
  // interpreta como decimal, de modo que "30000000.01" se lee como treinta
  // millones con un centavo, que es lo que escribiria cualquier cliente de
  // la API. La ambiguedad real -- un punto seguido de EXACTAMENTE tres
  // digitos, como "10.005" -- se resuelve por la convencion colombiana:
  // separador de miles.
  if (!sinSigno.includes(',') && /^\d+\.\d{1,2}$/.test(sinSigno)) {
    return new Decimal((negativo ? '-' : '') + sinSigno).toDecimalPlaces(2);
  }

  // El punto agrupa miles; la coma, si existe, abre los decimales.
  const [enteros, decimales = ''] = sinSigno.split(',');
  const canonico =
    (negativo ? '-' : '') +
    (enteros!.replace(/\./g, '') || '0') +
    (decimales === '' ? '' : `.${decimales.replace(/\./g, '')}`);

  if (!/^-?\d+(\.\d+)?$/.test(canonico)) {
    throw new RangeError(`Valor monetario invalido: "${texto}"`);
  }

  return new Decimal(canonico).toDecimalPlaces(2);
}

/* --- Aritmetica ---------------------------------------------------------- */

export const sumar = (...valores: DineroEntrada[]): Dinero =>
  valores.reduce<Dinero>((total, v) => total.plus(dinero(v)), CERO).toDecimalPlaces(2);

export const restar = (a: DineroEntrada, b: DineroEntrada): Dinero =>
  dinero(a).minus(dinero(b)).toDecimalPlaces(2);

export const multiplicar = (a: DineroEntrada, factor: number | string): Dinero =>
  dinero(a).times(factor).toDecimalPlaces(2);

/** Porcentaje de un valor. `porcentaje(precio, 30)` = 30% del precio. */
export const porcentaje = (a: DineroEntrada, pct: number | string): Dinero =>
  dinero(a).times(pct).dividedBy(100).toDecimalPlaces(2);

/** Nunca negativo: usado para que un saldo sobre-pagado no quede en rojo. */
export const restarSinNegativos = (a: DineroEntrada, b: DineroEntrada): Dinero =>
  Decimal.max(restar(a, b), CERO).toDecimalPlaces(2);

/* --- Comparacion --------------------------------------------------------- */
/* Estas son las funciones que reemplazan `saldo === 0`. */

export const esCero = (v: DineroEntrada): boolean => dinero(v).isZero();
export const esPositivo = (v: DineroEntrada): boolean => dinero(v).greaterThan(0);
export const esNegativo = (v: DineroEntrada): boolean => dinero(v).lessThan(0);
export const esMayor = (a: DineroEntrada, b: DineroEntrada): boolean => dinero(a).greaterThan(dinero(b));
export const esMenor = (a: DineroEntrada, b: DineroEntrada): boolean => dinero(a).lessThan(dinero(b));
export const esIgual = (a: DineroEntrada, b: DineroEntrada): boolean => dinero(a).equals(dinero(b));
export const esMayorOIgual = (a: DineroEntrada, b: DineroEntrada): boolean =>
  dinero(a).greaterThanOrEqualTo(dinero(b));
export const esMenorOIgual = (a: DineroEntrada, b: DineroEntrada): boolean =>
  dinero(a).lessThanOrEqualTo(dinero(b));

/** -1 si a < b, 0 si iguales, 1 si a > b. Para ordenar columnas de dinero. */
export const comparar = (a: DineroEntrada, b: DineroEntrada): -1 | 0 | 1 =>
  dinero(a).comparedTo(dinero(b)) as -1 | 0 | 1;

export const minimo = (...valores: DineroEntrada[]): Dinero =>
  Decimal.min(...valores.map(dinero)).toDecimalPlaces(2);
export const maximo = (...valores: DineroEntrada[]): Dinero =>
  Decimal.max(...valores.map(dinero)).toDecimalPlaces(2);

/* --- Serializacion ------------------------------------------------------- */

/** Cadena apta para persistir o transportar por JSON. Siempre "0.00". */
export const aTexto = (v: DineroEntrada): string => dinero(v).toFixed(2);

/**
 * Conversion a number. Solo para graficas y agregados de presentacion.
 * No usar para calculos: reintroduce el punto flotante.
 */
export const aNumero = (v: DineroEntrada): number => dinero(v).toNumber();

/* --- Formato ------------------------------------------------------------- */

const FORMATO_COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const FORMATO_COP_DECIMALES = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "$ 85.000.000". En el v0 esta funcion estaba reimplementada en cada
 * pagina (Pagos.jsx, Lotes.jsx, Dashboard.jsx, Ventas.jsx) con variantes.
 * El peso colombiano no usa centavos en la practica, por lo que se omiten
 * salvo que el valor realmente los tenga.
 */
export function formatearCOP(v: DineroEntrada, opciones?: { decimales?: boolean }): string {
  const d = dinero(v);
  const mostrarDecimales = opciones?.decimales ?? !d.modulo(1).isZero();
  return (mostrarDecimales ? FORMATO_COP_DECIMALES : FORMATO_COP).format(d.toNumber());
}

/** "85.000.000" sin simbolo, para celdas de tabla alineadas a la derecha. */
export function formatearCifra(v: DineroEntrada): string {
  const d = dinero(v);
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: d.modulo(1).isZero() ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(d.toNumber());
}

/**
 * Reparte un monto en N partes sin perder ni un centavo: el residuo del
 * redondeo se asigna a las primeras cuotas. Imprescindible para generar
 * planes de pago cuyas cuotas sumen exactamente el precio negociado.
 */
export function repartir(total: DineroEntrada, partes: number): Dinero[] {
  if (!Number.isInteger(partes) || partes < 1) {
    throw new RangeError(`Numero de partes invalido: ${partes}`);
  }

  const t = dinero(total);
  const centavosTotales = t.times(100).toDecimalPlaces(0);
  const base = centavosTotales.dividedToIntegerBy(partes);
  const residuo = centavosTotales.minus(base.times(partes)).toNumber();

  return Array.from({ length: partes }, (_, i) =>
    base.plus(i < residuo ? 1 : 0).dividedBy(100).toDecimalPlaces(2),
  );
}
