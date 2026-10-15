/* ==========================================================================
   Cartera y estado de cuenta
   --------------------------------------------------------------------------
   Regla central del sistema: EL SALDO NUNCA SE ALMACENA.

   En el v0 el saldo vivia en tres lugares a la vez -- `lote.saldo`,
   `cliente.saldo` y el recalculo de `calcularSaldo()` -- actualizados por
   funciones distintas (actualizarSaldoLote en Pagos.jsx:310 y la venta en
   Ventas.jsx). Cualquier fallo a mitad de camino los dejaba divergentes y
   no habia forma de saber cual era el correcto.

   Aqui el saldo es siempre una funcion pura de (precio negociado, pagos
   vigentes). La vista SQL `venta_estado_cuenta` implementa la misma formula
   en Postgres para los reportes.
   ========================================================================== */

import { EstadoCartera, TipoPago } from '../enums/index.js';
import {
  CERO,
  type Dinero,
  type DineroEntrada,
  dinero,
  esCero,
  esPositivo,
  restarSinNegativos,
  sumar,
} from './dinero.js';

export interface PagoVigente {
  readonly id: string;
  readonly monto: DineroEntrada;
  readonly fecha: Date;
  readonly tipo: TipoPago;
  /** Un pago anulado permanece en la base de datos pero no cuenta. */
  readonly anulado: boolean;
}

export interface CuotaEsperada {
  readonly id: string;
  readonly numero: number;
  readonly tipo: TipoPago;
  readonly montoEsperado: DineroEntrada;
  readonly fechaVencimiento: Date;
}

export interface EstadoCuenta {
  readonly precioNegociado: Dinero;
  readonly totalPagado: Dinero;
  readonly saldo: Dinero;
  readonly estado: EstadoCartera;
  /** Fraccion pagada, 0 a 100, con dos decimales. */
  readonly porcentajePagado: number;
  readonly cantidadPagos: number;
  readonly ultimoPago: Date | null;
  /** Cuotas vencidas y no cubiertas a la fecha de corte. */
  readonly cuotasEnMora: readonly CuotaEsperada[];
  readonly totalEnMora: Dinero;
  readonly diasMoraMaximo: number;
}

/** Suma de los pagos que cuentan. Los anulados se excluyen aqui, en un solo sitio. */
export function totalPagado(pagos: readonly PagoVigente[]): Dinero {
  return sumar(...pagos.filter((p) => !p.anulado).map((p) => p.monto));
}

/**
 * Saldo pendiente. Nunca negativo: si por un error de digitacion se
 * registra mas de lo debido, el saldo queda en cero y el exceso se reporta
 * aparte con `excedente()`, en lugar de mostrar un negativo en la cartera.
 */
export function saldoPendiente(
  precioNegociado: DineroEntrada,
  pagos: readonly PagoVigente[],
): Dinero {
  return restarSinNegativos(precioNegociado, totalPagado(pagos));
}

/** Cuanto se pago por encima del precio. Normalmente cero. */
export function excedente(
  precioNegociado: DineroEntrada,
  pagos: readonly PagoVigente[],
): Dinero {
  return restarSinNegativos(totalPagado(pagos), precioNegociado);
}

/**
 * Estado de cuenta completo de una venta.
 *
 * `fechaCorte` permite calcular la cartera a una fecha pasada, que es lo
 * que necesitan los reportes mensuales -- imposible en el v0, donde el
 * estado era un campo mutable sin historia.
 */
export function calcularEstadoCuenta(entrada: {
  precioNegociado: DineroEntrada;
  pagos: readonly PagoVigente[];
  cuotas?: readonly CuotaEsperada[];
  fechaCorte?: Date;
}): EstadoCuenta {
  const corte = entrada.fechaCorte ?? new Date();
  const vigentes = entrada.pagos.filter((p) => !p.anulado && p.fecha <= corte);

  const precio = dinero(entrada.precioNegociado);
  const pagado = sumar(...vigentes.map((p) => p.monto));
  const saldo = restarSinNegativos(precio, pagado);

  const porcentajePagado = esCero(precio)
    ? 100
    : Number(dinero(pagado).dividedBy(precio).times(100).toDecimalPlaces(2).toString());

  const fechas = vigentes.map((p) => p.fecha.getTime());
  const ultimoPago = fechas.length > 0 ? new Date(Math.max(...fechas)) : null;

  // Mora: cuotas ya vencidas que el total pagado no alcanza a cubrir.
  // Se imputa en orden de vencimiento, como en cualquier cartera.
  const cuotasEnMora: CuotaEsperada[] = [];
  let totalEnMora = CERO;

  if (entrada.cuotas && entrada.cuotas.length > 0) {
    const ordenadas = [...entrada.cuotas].sort(
      (a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime(),
    );

    let disponible = pagado;
    for (const cuota of ordenadas) {
      const esperado = dinero(cuota.montoEsperado);
      const cubierto = esperado.lessThanOrEqualTo(disponible) ? esperado : dinero(disponible);
      disponible = restarSinNegativos(disponible, cubierto);

      const faltante = restarSinNegativos(esperado, cubierto);
      if (esPositivo(faltante) && cuota.fechaVencimiento < corte) {
        cuotasEnMora.push(cuota);
        totalEnMora = sumar(totalEnMora, faltante);
      }
    }
  }

  const diasMoraMaximo = cuotasEnMora.reduce((max, c) => {
    const dias = Math.floor((corte.getTime() - c.fechaVencimiento.getTime()) / 86_400_000);
    return Math.max(max, dias);
  }, 0);

  return {
    precioNegociado: precio,
    totalPagado: pagado,
    saldo,
    estado: clasificarCartera({ saldo, pagado, enMora: esPositivo(totalEnMora) }),
    porcentajePagado,
    cantidadPagos: vigentes.length,
    ultimoPago,
    cuotasEnMora,
    totalEnMora,
    diasMoraMaximo,
  };
}

/**
 * Clasificacion de la cartera. Esta es la funcion que en el v0 era
 * `if (saldo === 0) return 'PAGADO'` sobre un float.
 */
export function clasificarCartera(entrada: {
  saldo: DineroEntrada;
  pagado: DineroEntrada;
  enMora?: boolean;
}): EstadoCartera {
  if (esCero(entrada.saldo)) return EstadoCartera.PAGADO;
  if (entrada.enMora) return EstadoCartera.EN_MORA;
  if (esPositivo(entrada.pagado)) return EstadoCartera.PARCIAL;
  return EstadoCartera.PENDIENTE;
}

/** La regla del documento original: saldo cero => lote PAGADO. */
export function estaLiquidada(
  precioNegociado: DineroEntrada,
  pagos: readonly PagoVigente[],
): boolean {
  return esCero(saldoPendiente(precioNegociado, pagos));
}

/* --------------------------------------------------------------------------
   Agregados de cartera, para el dashboard y los reportes
   -------------------------------------------------------------------------- */

export interface ResumenCartera {
  readonly valorVendido: Dinero;
  readonly recaudado: Dinero;
  readonly porCobrar: Dinero;
  readonly enMora: Dinero;
  readonly ventasLiquidadas: number;
  readonly ventasPendientes: number;
  readonly ventasEnMora: number;
}

export function resumirCartera(cuentas: readonly EstadoCuenta[]): ResumenCartera {
  return {
    valorVendido: sumar(...cuentas.map((c) => c.precioNegociado)),
    recaudado: sumar(...cuentas.map((c) => c.totalPagado)),
    porCobrar: sumar(...cuentas.map((c) => c.saldo)),
    enMora: sumar(...cuentas.map((c) => c.totalEnMora)),
    ventasLiquidadas: cuentas.filter((c) => c.estado === EstadoCartera.PAGADO).length,
    ventasPendientes: cuentas.filter((c) => c.estado !== EstadoCartera.PAGADO).length,
    ventasEnMora: cuentas.filter((c) => c.estado === EstadoCartera.EN_MORA).length,
  };
}
