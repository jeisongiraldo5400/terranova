/* ==========================================================================
   Maquinas de estado
   --------------------------------------------------------------------------
   En el v0 el estado del lote se escribia con asignaciones directas
   (`estado: 'Vendido'`) en 16 puntos del codigo, sin ninguna validacion de
   que la transicion fuera legal. Era posible vender un lote ya vendido,
   o devolver a DISPONIBLE un lote con pagos registrados.

   Aqui las transiciones legales se declaran una sola vez. La API consulta
   `puedeTransicionar` antes de escribir, y la UI la consulta para decidir
   que botones habilitar: misma respuesta en los dos lados.
   ========================================================================== */

import { EstadoLote, EstadoVenta } from '../enums/index.js';
import { ErrorTransicion } from './errores.js';

/* --------------------------------------------------------------------------
   LOTE

     DISPONIBLE --reservar--> RESERVADO --vender--> VENDIDO --liquidar--> PAGADO
         ^                        |                    |  ^                   |
         |                        |                    |  |  anular un pago   |
         |                        |                    |  +-------------------+
         +------- liberar --------+--- anular venta ---+-----------------------+

   PAGADO vuelve a VENDIDO cuando se anula un pago de una venta ya
   liquidada: el cheque se devuelve, reaparece saldo y el lote deja de
   estar pagado sin dejar de estar vendido. Omitir esta transicion hacia
   atras bloqueaba la anulacion de pagos sobre ventas liquidadas.

   BLOQUEADO es una salida administrativa (lote en litigio, zona verde
   reclasificada, error de loteo) accesible solo desde DISPONIBLE.
   -------------------------------------------------------------------------- */

export const TRANSICIONES_LOTE: Record<EstadoLote, readonly EstadoLote[]> = {
  DISPONIBLE: ['RESERVADO', 'VENDIDO', 'BLOQUEADO'],
  RESERVADO: ['VENDIDO', 'DISPONIBLE'],
  VENDIDO: ['PAGADO', 'DISPONIBLE'],
  PAGADO: ['VENDIDO', 'DISPONIBLE'],
  BLOQUEADO: ['DISPONIBLE'],
} as const;

export function puedeTransicionarLote(desde: EstadoLote, hacia: EstadoLote): boolean {
  return TRANSICIONES_LOTE[desde].includes(hacia);
}

export function assertTransicionLote(desde: EstadoLote, hacia: EstadoLote): void {
  if (desde === hacia) return;
  if (!puedeTransicionarLote(desde, hacia)) {
    throw new ErrorTransicion(
      `Un lote en estado ${desde} no puede pasar a ${hacia}.`,
      { desde, hacia, permitidas: TRANSICIONES_LOTE[desde] },
    );
  }
}

/** Un lote solo se puede poner en venta desde estos estados. */
export const ESTADOS_VENDIBLES: readonly EstadoLote[] = ['DISPONIBLE', 'RESERVADO'] as const;

export const esVendible = (estado: EstadoLote): boolean => ESTADOS_VENDIBLES.includes(estado);

/** Un lote con venta activa o liquidada no se puede editar ni eliminar. */
export const estaComprometido = (estado: EstadoLote): boolean =>
  estado === 'VENDIDO' || estado === 'PAGADO';

/* --------------------------------------------------------------------------
   VENTA

     ACTIVA --saldo llega a cero--> LIQUIDADA
       |                                |
       +----------- anular -------------+--> ANULADA  (estado terminal)
   -------------------------------------------------------------------------- */

export const TRANSICIONES_VENTA: Record<EstadoVenta, readonly EstadoVenta[]> = {
  ACTIVA: ['LIQUIDADA', 'ANULADA'],
  LIQUIDADA: ['ACTIVA', 'ANULADA'],
  ANULADA: [],
} as const;

export function puedeTransicionarVenta(desde: EstadoVenta, hacia: EstadoVenta): boolean {
  return TRANSICIONES_VENTA[desde].includes(hacia);
}

export function assertTransicionVenta(desde: EstadoVenta, hacia: EstadoVenta): void {
  if (desde === hacia) return;
  if (!puedeTransicionarVenta(desde, hacia)) {
    throw new ErrorTransicion(
      `Una venta en estado ${desde} no puede pasar a ${hacia}.`,
      { desde, hacia, permitidas: TRANSICIONES_VENTA[desde] },
    );
  }
}

/** Solo las ventas no anuladas aceptan pagos. */
export const aceptaPagos = (estado: EstadoVenta): boolean => estado !== 'ANULADA';

/* --------------------------------------------------------------------------
   Estado del lote derivado de la venta
   -------------------------------------------------------------------------- */

/**
 * El estado del lote es consecuencia del estado de su venta, no un dato
 * independiente. En el v0 eran dos campos sueltos que podian divergir:
 * `estado` lo escribia Ventas.jsx y `estadoDeuda` lo escribia Pagos.jsx.
 */
export function estadoLoteSegunVenta(estadoVenta: EstadoVenta): EstadoLote {
  switch (estadoVenta) {
    case 'ACTIVA':
      return 'VENDIDO';
    case 'LIQUIDADA':
      return 'PAGADO';
    case 'ANULADA':
      return 'DISPONIBLE';
  }
}
