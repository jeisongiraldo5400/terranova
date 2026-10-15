import { describe, expect, it } from 'vitest';
import { aTexto } from './dinero.js';
import {
  calcularEstadoCuenta, estaLiquidada, resumirCartera, saldoPendiente,
  totalPagado, type PagoVigente, type CuotaEsperada,
} from './cartera.js';

type PagoDePrueba = Omit<Partial<PagoVigente>, 'fecha' | 'monto'> & {
  monto: string;
  fecha: string;
};

let secuencia = 0;

const pago = ({ fecha, ...resto }: PagoDePrueba): PagoVigente => ({
  id: `pago-${++secuencia}`,
  tipo: 'ABONO',
  anulado: false,
  ...resto,
  fecha: new Date(fecha),
});

describe('saldo pendiente', () => {
  it('excluye los pagos anulados', () => {
    const pagos = [
      pago({ monto: '30000000', fecha: '2026-01-15' }),
      pago({ monto: '20000000', fecha: '2026-02-15', anulado: true }),
    ];
    expect(aTexto(totalPagado(pagos))).toBe('30000000.00');
    expect(aTexto(saldoPendiente('85000000', pagos))).toBe('55000000.00');
  });

  it('nunca es negativo si se paga de mas', () => {
    const pagos = [pago({ monto: '90000000', fecha: '2026-01-15' })];
    expect(aTexto(saldoPendiente('85000000', pagos))).toBe('0.00');
  });

  it('marca la venta como liquidada cuando el saldo llega a cero', () => {
    const pagos = [
      pago({ monto: '25500000', fecha: '2026-01-15', tipo: 'CUOTA_INICIAL' }),
      pago({ monto: '59500000', fecha: '2026-06-15', tipo: 'PAGO_FINAL' }),
    ];
    expect(estaLiquidada('85000000', pagos)).toBe(true);
  });

  /* Regresion: en el v0 este caso dejaba el lote en VENDIDO para siempre. */
  it('liquida correctamente con montos que generan residuo decimal', () => {
    const pagos = [
      pago({ monto: '28333333.34', fecha: '2026-01-15' }),
      pago({ monto: '28333333.33', fecha: '2026-02-15' }),
      pago({ monto: '28333333.33', fecha: '2026-03-15' }),
    ];
    expect(estaLiquidada('85000000', pagos)).toBe(true);
  });
});

describe('estado de cuenta', () => {
  it('clasifica como PENDIENTE sin pagos', () => {
    const c = calcularEstadoCuenta({ precioNegociado: '85000000', pagos: [] });
    expect(c.estado).toBe('PENDIENTE');
    expect(c.porcentajePagado).toBe(0);
    expect(c.ultimoPago).toBeNull();
  });

  it('clasifica como PARCIAL con abonos', () => {
    const c = calcularEstadoCuenta({
      precioNegociado: '85000000',
      pagos: [pago({ monto: '25500000', fecha: '2026-01-15' })],
    });
    expect(c.estado).toBe('PARCIAL');
    expect(c.porcentajePagado).toBe(30);
    expect(aTexto(c.saldo)).toBe('59500000.00');
  });

  it('clasifica como PAGADO al liquidar', () => {
    const c = calcularEstadoCuenta({
      precioNegociado: '85000000',
      pagos: [pago({ monto: '85000000', fecha: '2026-01-15' })],
    });
    expect(c.estado).toBe('PAGADO');
    expect(c.porcentajePagado).toBe(100);
  });

  it('respeta la fecha de corte para la cartera historica', () => {
    const pagos = [
      pago({ monto: '25500000', fecha: '2026-01-15' }),
      pago({ monto: '59500000', fecha: '2026-06-15' }),
    ];
    // Al 31 de marzo solo se habia recibido la cuota inicial.
    const c = calcularEstadoCuenta({
      precioNegociado: '85000000',
      pagos,
      fechaCorte: new Date('2026-03-31'),
    });
    expect(aTexto(c.totalPagado)).toBe('25500000.00');
    expect(c.estado).toBe('PARCIAL');
  });

  it('detecta mora sobre las cuotas vencidas', () => {
    const cuotas: CuotaEsperada[] = [
      { id: 'c1', numero: 1, tipo: 'CUOTA_INICIAL', montoEsperado: '25500000', fechaVencimiento: new Date('2026-01-15') },
      { id: 'c2', numero: 2, tipo: 'PAGO_FINAL', montoEsperado: '59500000', fechaVencimiento: new Date('2026-06-15') },
    ];
    const c = calcularEstadoCuenta({
      precioNegociado: '85000000',
      pagos: [pago({ monto: '25500000', fecha: '2026-01-15' })],
      cuotas,
      fechaCorte: new Date('2026-07-15'),
    });

    expect(c.estado).toBe('EN_MORA');
    expect(c.cuotasEnMora).toHaveLength(1);
    expect(c.cuotasEnMora[0]!.id).toBe('c2');
    expect(aTexto(c.totalEnMora)).toBe('59500000.00');
    expect(c.diasMoraMaximo).toBe(30);
  });

  it('no reporta mora si las cuotas vencidas estan cubiertas', () => {
    const cuotas: CuotaEsperada[] = [
      { id: 'c1', numero: 1, tipo: 'CUOTA_INICIAL', montoEsperado: '25500000', fechaVencimiento: new Date('2026-01-15') },
      { id: 'c2', numero: 2, tipo: 'PAGO_FINAL', montoEsperado: '59500000', fechaVencimiento: new Date('2026-06-15') },
    ];
    const c = calcularEstadoCuenta({
      precioNegociado: '85000000',
      pagos: [pago({ monto: '25500000', fecha: '2026-01-10' })],
      cuotas,
      fechaCorte: new Date('2026-02-01'),
    });
    expect(c.estado).toBe('PARCIAL');
    expect(c.cuotasEnMora).toHaveLength(0);
  });
});

describe('resumen de cartera', () => {
  it('agrega los totales del portafolio', () => {
    const cuentas = [
      calcularEstadoCuenta({ precioNegociado: '85000000', pagos: [pago({ monto: '85000000', fecha: '2026-01-15' })] }),
      calcularEstadoCuenta({ precioNegociado: '60000000', pagos: [pago({ monto: '18000000', fecha: '2026-02-15' })] }),
      calcularEstadoCuenta({ precioNegociado: '40000000', pagos: [] }),
    ];
    const r = resumirCartera(cuentas);

    expect(aTexto(r.valorVendido)).toBe('185000000.00');
    expect(aTexto(r.recaudado)).toBe('103000000.00');
    expect(aTexto(r.porCobrar)).toBe('82000000.00');
    expect(r.ventasLiquidadas).toBe(1);
    expect(r.ventasPendientes).toBe(2);
  });
});
