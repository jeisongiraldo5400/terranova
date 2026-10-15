/* ==========================================================================
   Plan de pago
   --------------------------------------------------------------------------
   El documento original dice: "El cliente realiza dos pagos: cuota inicial
   y pago final". El codigo del v0 permitia abonos libres ilimitados. Las dos
   cosas estaban en conflicto y ninguna estaba modelada.

   Este modulo resuelve el conflicto en lugar de elegir un lado: el plan por
   defecto son exactamente dos cuotas (la regla del documento), pero la
   estructura admite N cuotas sin cambiar una linea de codigo del resto del
   sistema. Si manana el negocio vende a 12 meses, es un plan distinto, no
   una reescritura.
   ========================================================================== */

import { TipoPago } from '../enums/index.js';
import {
  type Dinero,
  type DineroEntrada,
  dinero,
  esCero,
  esMayor,
  esPositivo,
  porcentaje,
  repartir,
  restar,
  sumar,
} from './dinero.js';
import { ErrorReglaNegocio } from './errores.js';

export interface CuotaPlanificada {
  readonly numero: number;
  readonly tipo: TipoPago;
  readonly montoEsperado: Dinero;
  readonly fechaVencimiento: Date;
  readonly descripcion: string;
}

export interface PlanPagoCalculado {
  readonly precioNegociado: Dinero;
  readonly cuotaInicial: Dinero;
  readonly saldoFinanciado: Dinero;
  readonly cuotas: readonly CuotaPlanificada[];
}

export const PORCENTAJE_CUOTA_INICIAL_MINIMO = 10;

/** Modalidad del plan: dos pagos (la del documento) o cuotas mensuales. */
export type ModalidadPlan =
  | { tipo: 'DOS_PAGOS'; fechaLimitePagoFinal: Date }
  | { tipo: 'CUOTAS'; numeroCuotas: number; diaPago?: number };

export interface EntradaPlan {
  precioNegociado: DineroEntrada;
  /** Monto exacto de la cuota inicial. Alternativa a `porcentajeInicial`. */
  cuotaInicial?: DineroEntrada;
  /** Porcentaje del precio, 0 a 100. Alternativa a `cuotaInicial`. */
  porcentajeInicial?: number;
  fechaVenta: Date;
  modalidad: ModalidadPlan;
}

/**
 * Construye el plan de pago. Garantiza que las cuotas sumen exactamente el
 * precio negociado: el reparto usa `repartir()`, que distribuye el residuo
 * del redondeo y no pierde centavos.
 */
export function calcularPlanPago(entrada: EntradaPlan): PlanPagoCalculado {
  const precio = dinero(entrada.precioNegociado);

  if (!esPositivo(precio)) {
    throw new ErrorReglaNegocio('El precio negociado debe ser mayor que cero.');
  }

  const inicial = resolverCuotaInicial(precio, entrada);

  if (esMayor(inicial, precio)) {
    throw new ErrorReglaNegocio(
      'La cuota inicial no puede ser mayor que el precio negociado.',
      { cuotaInicial: inicial.toFixed(2), precioNegociado: precio.toFixed(2) },
    );
  }

  const minimo = porcentaje(precio, PORCENTAJE_CUOTA_INICIAL_MINIMO);
  if (esPositivo(minimo) && inicial.lessThan(minimo)) {
    throw new ErrorReglaNegocio(
      `La cuota inicial debe ser al menos el ${PORCENTAJE_CUOTA_INICIAL_MINIMO}% del precio.`,
      { minimo: minimo.toFixed(2), recibido: inicial.toFixed(2) },
    );
  }

  const saldoFinanciado = restar(precio, inicial);
  const cuotas: CuotaPlanificada[] = [
    {
      numero: 1,
      tipo: TipoPago.CUOTA_INICIAL,
      montoEsperado: inicial,
      fechaVencimiento: entrada.fechaVenta,
      descripcion: 'Cuota inicial',
    },
  ];

  if (esCero(saldoFinanciado)) {
    // Pago de contado: la cuota inicial cubre todo el precio.
    return { precioNegociado: precio, cuotaInicial: inicial, saldoFinanciado, cuotas };
  }

  if (entrada.modalidad.tipo === 'DOS_PAGOS') {
    if (entrada.modalidad.fechaLimitePagoFinal <= entrada.fechaVenta) {
      throw new ErrorReglaNegocio(
        'La fecha limite del pago final debe ser posterior a la fecha de venta.',
      );
    }

    cuotas.push({
      numero: 2,
      tipo: TipoPago.PAGO_FINAL,
      montoEsperado: saldoFinanciado,
      fechaVencimiento: entrada.modalidad.fechaLimitePagoFinal,
      descripcion: 'Pago final',
    });
  } else {
    const n = entrada.modalidad.numeroCuotas;
    if (!Number.isInteger(n) || n < 1 || n > 240) {
      throw new ErrorReglaNegocio('El numero de cuotas debe estar entre 1 y 240.');
    }

    const montos = repartir(saldoFinanciado, n);
    const diaPago = entrada.modalidad.diaPago ?? entrada.fechaVenta.getUTCDate();

    montos.forEach((monto, i) => {
      const esUltima = i === montos.length - 1;
      cuotas.push({
        numero: i + 2,
        tipo: esUltima ? TipoPago.PAGO_FINAL : TipoPago.ABONO,
        montoEsperado: monto,
        fechaVencimiento: sumarMeses(entrada.fechaVenta, i + 1, diaPago),
        descripcion: esUltima ? 'Pago final' : `Cuota ${i + 1} de ${n}`,
      });
    });
  }

  // Invariante no negociable: el plan debe cuadrar al centavo con el precio.
  const sumaCuotas = sumar(...cuotas.map((c) => c.montoEsperado));
  if (!sumaCuotas.equals(precio)) {
    throw new ErrorReglaNegocio(
      'Error interno: las cuotas del plan no suman el precio negociado.',
      { sumaCuotas: sumaCuotas.toFixed(2), precioNegociado: precio.toFixed(2) },
    );
  }

  return { precioNegociado: precio, cuotaInicial: inicial, saldoFinanciado, cuotas };
}

function resolverCuotaInicial(precio: Dinero, entrada: EntradaPlan): Dinero {
  if (entrada.cuotaInicial !== undefined) return dinero(entrada.cuotaInicial);
  if (entrada.porcentajeInicial !== undefined) {
    if (entrada.porcentajeInicial < 0 || entrada.porcentajeInicial > 100) {
      throw new ErrorReglaNegocio('El porcentaje de cuota inicial debe estar entre 0 y 100.');
    }
    return porcentaje(precio, entrada.porcentajeInicial);
  }
  throw new ErrorReglaNegocio('Debe indicar la cuota inicial o su porcentaje.');
}

/**
 * Suma meses respetando el dia de pago y los meses cortos: con dia 31, en
 * febrero vence el 28 (o 29), no el 3 de marzo.
 */
export function sumarMeses(base: Date, meses: number, dia: number): Date {
  // Getters UTC a proposito: las fechas del negocio son dias calendario, no
  // instantes. Mezclar getters locales con Date.UTC corre el vencimiento un
  // dia hacia atras en zonas con desplazamiento negativo como America/Bogota.
  const anio = base.getUTCFullYear();
  const mes = base.getUTCMonth() + meses;
  const ultimoDiaDelMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes, Math.min(dia, ultimoDiaDelMes)));
}
