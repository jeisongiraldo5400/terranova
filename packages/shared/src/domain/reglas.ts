/* ==========================================================================
   Reglas de negocio
   --------------------------------------------------------------------------
   Cada funcion es una regla del documento original o una salvaguarda que el
   v0 no tenia. Son puras y se invocan desde la API, desde los tests y desde
   el importador de datos heredados, de modo que ningun camino de entrada
   puede saltarselas.
   ========================================================================== */

import { EstadoLote, EstadoVenta, TipoPago } from '../enums/index.js';
import {
  type DineroEntrada,
  dinero,
  esMayor,
  esCero,
  esPositivo,
  formatearCOP,
} from './dinero.js';
import { ErrorReglaNegocio } from './errores.js';
import { aceptaPagos, esVendible } from './estados.js';
import { type PagoVigente, saldoPendiente } from './cartera.js';

/** Regla del documento: "El lote minimo es de 1000 m2". */
export const AREA_MINIMA_M2_POR_DEFECTO = 1000;

/* --------------------------------------------------------------------------
   Lotes
   -------------------------------------------------------------------------- */

/**
 * El v0 no podia aplicar esta regla: el formulario de lotes solo pedia
 * `codigo` y `precio`, no existia el campo de area.
 */
export function assertAreaMinima(areaM2: number, areaMinima = AREA_MINIMA_M2_POR_DEFECTO): void {
  if (!Number.isFinite(areaM2) || areaM2 <= 0) {
    throw new ErrorReglaNegocio('El area del lote debe ser un numero positivo.');
  }
  if (areaM2 < areaMinima) {
    throw new ErrorReglaNegocio(
      `El area del lote (${areaM2} m2) es menor que el minimo permitido de ${areaMinima} m2.`,
      { areaM2, areaMinima },
    );
  }
}

export function assertPrecioValido(precio: DineroEntrada, etiqueta = 'El precio'): void {
  const p = dinero(precio);
  if (!esPositivo(p)) {
    throw new ErrorReglaNegocio(`${etiqueta} debe ser mayor que cero.`);
  }
}

/** Un lote comprometido no se puede editar ni eliminar. */
export function assertLoteEditable(estado: EstadoLote): void {
  if (estado === 'VENDIDO' || estado === 'PAGADO') {
    throw new ErrorReglaNegocio(
      `No se puede modificar un lote en estado ${estado}. Anule la venta primero.`,
      { estado },
    );
  }
}

/* --------------------------------------------------------------------------
   Ventas
   -------------------------------------------------------------------------- */

/**
 * El v0 solo comprobaba `lote.estado === 'Vendido'` en memoria, sin bloqueo
 * ni transaccion: dos usuarios podian vender el mismo lote simultaneamente.
 * Esta validacion se complementa con `SELECT ... FOR UPDATE` en el servicio
 * y con el indice unico parcial de la base de datos.
 */
export function assertLoteVendible(estado: EstadoLote, codigoLote: string): void {
  if (!esVendible(estado)) {
    throw new ErrorReglaNegocio(
      `El lote ${codigoLote} no esta disponible para venta (estado actual: ${estado}).`,
      { estado, codigoLote },
    );
  }
}

export function assertFechaVentaValida(fechaVenta: Date, hoy = new Date()): void {
  if (Number.isNaN(fechaVenta.getTime())) {
    throw new ErrorReglaNegocio('La fecha de venta no es valida.');
  }
  if (fechaVenta > finDelDia(hoy)) {
    throw new ErrorReglaNegocio('La fecha de venta no puede ser futura.');
  }
}

export function assertVentaAnulable(estado: EstadoVenta): void {
  if (estado === 'ANULADA') {
    throw new ErrorReglaNegocio('Esta venta ya se encuentra anulada.');
  }
}

/* --------------------------------------------------------------------------
   Pagos
   -------------------------------------------------------------------------- */

export interface ContextoPago {
  readonly precioNegociado: DineroEntrada;
  readonly pagosExistentes: readonly PagoVigente[];
  readonly estadoVenta: EstadoVenta;
  readonly fechaVenta: Date;
}

/**
 * Validacion completa de un pago. El v0 solo verificaba que el monto no
 * excediera el saldo (Pagos.jsx:187); las otras cuatro reglas no existian,
 * de modo que se podian registrar pagos con fecha futura, anteriores a la
 * venta, de monto cero, o sobre una venta inexistente.
 */
export function assertPagoValido(
  pago: { monto: DineroEntrada; fecha: Date; tipo: TipoPago },
  ctx: ContextoPago,
  hoy = new Date(),
): void {
  if (!aceptaPagos(ctx.estadoVenta)) {
    throw new ErrorReglaNegocio('No se pueden registrar pagos sobre una venta anulada.');
  }

  const monto = dinero(pago.monto);
  if (!esPositivo(monto)) {
    throw new ErrorReglaNegocio('El monto del pago debe ser mayor que cero.');
  }

  if (Number.isNaN(pago.fecha.getTime())) {
    throw new ErrorReglaNegocio('La fecha del pago no es valida.');
  }

  if (pago.fecha > finDelDia(hoy)) {
    throw new ErrorReglaNegocio('El pago no puede tener fecha futura.');
  }

  if (inicioDelDia(pago.fecha) < inicioDelDia(ctx.fechaVenta)) {
    throw new ErrorReglaNegocio(
      'El pago no puede ser anterior a la fecha de la venta.',
      { fechaPago: pago.fecha.toISOString(), fechaVenta: ctx.fechaVenta.toISOString() },
    );
  }

  const saldo = saldoPendiente(ctx.precioNegociado, ctx.pagosExistentes);

  if (esCero(saldo)) {
    throw new ErrorReglaNegocio('Esta venta ya esta totalmente pagada.');
  }

  if (esMayor(monto, saldo)) {
    throw new ErrorReglaNegocio(
      `El pago de ${formatearCOP(monto)} excede el saldo pendiente de ${formatearCOP(saldo)}.`,
      { monto: monto.toFixed(2), saldo: saldo.toFixed(2) },
    );
  }
}

/**
 * Un pago no se borra: se anula y queda el rastro. El v0 lo eliminaba del
 * arreglo (Pagos.jsx:395), con lo que el dinero desaparecia sin huella.
 */
export function assertPagoAnulable(pago: { anulado: boolean }, motivo: string): void {
  if (pago.anulado) {
    throw new ErrorReglaNegocio('Este pago ya se encuentra anulado.');
  }
  if (motivo.trim().length < 10) {
    throw new ErrorReglaNegocio(
      'Debe indicar el motivo de la anulacion (minimo 10 caracteres).',
    );
  }
}

/* --------------------------------------------------------------------------
   Clientes
   -------------------------------------------------------------------------- */

/** No se elimina un cliente con ventas vigentes: se desactiva. */
export function assertClienteEliminable(ventasVigentes: number): void {
  if (ventasVigentes > 0) {
    throw new ErrorReglaNegocio(
      `No se puede eliminar un cliente con ${ventasVigentes} venta(s) vigente(s). ` +
        'Puede desactivarlo en su lugar.',
      { ventasVigentes },
    );
  }
}

/** Valida el formato de la cedula o NIT colombianos. */
export function assertDocumentoValido(documento: string): void {
  const limpio = documento.replace(/[\s.-]/g, '');
  if (!/^\d{6,15}$/.test(limpio)) {
    throw new ErrorReglaNegocio(
      'El documento debe contener entre 6 y 15 digitos.',
      { documento },
    );
  }
}

/** Normaliza el documento para comparar y detectar duplicados: "1.234.567" -> "1234567". */
export const normalizarDocumento = (documento: string): string =>
  documento.replace(/[\s.-]/g, '');

/* --------------------------------------------------------------------------
   Utilidades de fecha
   -------------------------------------------------------------------------- */

/**
 * Limites del dia calendario en UTC.
 *
 * Todo el sistema trata las fechas de negocio como dias UTC: asi se
 * guardan (@db.Date), asi los normaliza fechaSchema y asi los compara
 * sumarMeses. Usar hora local en un solo punto de la cadena es lo que
 * corria los vencimientos un dia hacia atras.
 */
export function inicioDelDia(f: Date): Date {
  return new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()));
}

export function finDelDia(f: Date): Date {
  return new Date(
    Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate(), 23, 59, 59, 999),
  );
}
