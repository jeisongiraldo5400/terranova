import { describe, expect, it } from 'vitest';
import { calcularPlanPago, sumarMeses } from './plan-pago.js';
import { aTexto, sumar } from './dinero.js';
import { ErrorReglaNegocio } from './errores.js';

const FECHA_VENTA = new Date('2026-01-15');

describe('plan de dos pagos (regla del documento original)', () => {
  it('genera cuota inicial y pago final que suman el precio', () => {
    const plan = calcularPlanPago({
      precioNegociado: '85000000',
      porcentajeInicial: 30,
      fechaVenta: FECHA_VENTA,
      modalidad: { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: new Date('2026-07-15') },
    });

    expect(plan.cuotas).toHaveLength(2);
    expect(aTexto(plan.cuotaInicial)).toBe('25500000.00');
    expect(aTexto(plan.saldoFinanciado)).toBe('59500000.00');

    expect(plan.cuotas[0]!.tipo).toBe('CUOTA_INICIAL');
    expect(plan.cuotas[1]!.tipo).toBe('PAGO_FINAL');
    expect(aTexto(sumar(...plan.cuotas.map((c) => c.montoEsperado)))).toBe('85000000.00');
  });

  it('acepta el monto exacto de la cuota inicial', () => {
    const plan = calcularPlanPago({
      precioNegociado: '85000000',
      cuotaInicial: '20000000',
      fechaVenta: FECHA_VENTA,
      modalidad: { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: new Date('2026-07-15') },
    });
    expect(aTexto(plan.cuotas[1]!.montoEsperado)).toBe('65000000.00');
  });

  it('trata el pago de contado como una sola cuota', () => {
    const plan = calcularPlanPago({
      precioNegociado: '85000000',
      porcentajeInicial: 100,
      fechaVenta: FECHA_VENTA,
      modalidad: { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: new Date('2026-07-15') },
    });
    expect(plan.cuotas).toHaveLength(1);
    expect(aTexto(plan.saldoFinanciado)).toBe('0.00');
  });

  it('exige que el pago final venza despues de la venta', () => {
    expect(() =>
      calcularPlanPago({
        precioNegociado: '85000000',
        porcentajeInicial: 30,
        fechaVenta: FECHA_VENTA,
        modalidad: { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: new Date('2026-01-01') },
      }),
    ).toThrow(/posterior a la fecha de venta/);
  });
});

describe('plan de cuotas (extension sin tocar el resto del sistema)', () => {
  it('reparte el saldo en N cuotas que cuadran al centavo', () => {
    const plan = calcularPlanPago({
      precioNegociado: '85000000',
      porcentajeInicial: 30,
      fechaVenta: FECHA_VENTA,
      modalidad: { tipo: 'CUOTAS', numeroCuotas: 12 },
    });

    expect(plan.cuotas).toHaveLength(13); // inicial + 12
    expect(aTexto(sumar(...plan.cuotas.map((c) => c.montoEsperado)))).toBe('85000000.00');
    expect(plan.cuotas.at(-1)!.tipo).toBe('PAGO_FINAL');
  });

  it('cuadra para cualquier numero de cuotas', () => {
    for (const n of [1, 2, 3, 7, 12, 24, 36, 60]) {
      const plan = calcularPlanPago({
        precioNegociado: '123456789',
        porcentajeInicial: 15,
        fechaVenta: FECHA_VENTA,
        modalidad: { tipo: 'CUOTAS', numeroCuotas: n },
      });
      expect(aTexto(sumar(...plan.cuotas.map((c) => c.montoEsperado)))).toBe('123456789.00');
    }
  });

  it('programa los vencimientos mes a mes', () => {
    const plan = calcularPlanPago({
      precioNegociado: '60000000',
      porcentajeInicial: 20,
      fechaVenta: new Date('2026-01-15'),
      modalidad: { tipo: 'CUOTAS', numeroCuotas: 3 },
    });
    expect(plan.cuotas[1]!.fechaVencimiento.toISOString().slice(0, 10)).toBe('2026-02-15');
    expect(plan.cuotas[2]!.fechaVencimiento.toISOString().slice(0, 10)).toBe('2026-03-15');
    expect(plan.cuotas[3]!.fechaVencimiento.toISOString().slice(0, 10)).toBe('2026-04-15');
  });

  it('rechaza un numero de cuotas fuera de rango', () => {
    expect(() =>
      calcularPlanPago({
        precioNegociado: '85000000', porcentajeInicial: 30, fechaVenta: FECHA_VENTA,
        modalidad: { tipo: 'CUOTAS', numeroCuotas: 500 },
      }),
    ).toThrow(/entre 1 y 240/);
  });
});

describe('validaciones del plan', () => {
  it('rechaza precio no positivo', () => {
    expect(() =>
      calcularPlanPago({
        precioNegociado: '0', porcentajeInicial: 30, fechaVenta: FECHA_VENTA,
        modalidad: { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: new Date('2026-07-15') },
      }),
    ).toThrow(/mayor que cero/);
  });

  it('rechaza cuota inicial mayor al precio', () => {
    expect(() =>
      calcularPlanPago({
        precioNegociado: '85000000', cuotaInicial: '90000000', fechaVenta: FECHA_VENTA,
        modalidad: { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: new Date('2026-07-15') },
      }),
    ).toThrow(/no puede ser mayor que el precio/);
  });

  it('exige la cuota inicial minima del 10%', () => {
    expect(() =>
      calcularPlanPago({
        precioNegociado: '85000000', porcentajeInicial: 5, fechaVenta: FECHA_VENTA,
        modalidad: { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: new Date('2026-07-15') },
      }),
    ).toThrow(/al menos el 10%/);
  });

  it('exige indicar monto o porcentaje', () => {
    expect(() =>
      calcularPlanPago({
        precioNegociado: '85000000', fechaVenta: FECHA_VENTA,
        modalidad: { tipo: 'DOS_PAGOS', fechaLimitePagoFinal: new Date('2026-07-15') },
      }),
    ).toThrow(ErrorReglaNegocio);
  });
});

describe('sumarMeses', () => {
  it('respeta los meses cortos', () => {
    // Con dia 31, en febrero vence el 28, no el 3 de marzo.
    expect(sumarMeses(new Date('2026-01-31'), 1, 31).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(sumarMeses(new Date('2024-01-31'), 1, 31).toISOString().slice(0, 10)).toBe('2024-02-29');
  });

  it('cruza el fin de ano', () => {
    expect(sumarMeses(new Date('2026-11-15'), 3, 15).toISOString().slice(0, 10)).toBe('2027-02-15');
  });
});
