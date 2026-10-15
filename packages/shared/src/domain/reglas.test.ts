import { describe, expect, it } from 'vitest';
import {
  assertAreaMinima, assertClienteEliminable, assertDocumentoValido,
  assertFechaVentaValida, assertLoteEditable, assertLoteVendible,
  assertPagoAnulable, assertPagoValido, assertPrecioValido,
  normalizarDocumento, type ContextoPago,
} from './reglas.js';
import { ErrorReglaNegocio } from './errores.js';
import type { PagoVigente } from './cartera.js';

const HOY = new Date('2026-06-15T12:00:00Z');

const ctx = (over: Partial<ContextoPago> = {}): ContextoPago => ({
  precioNegociado: '85000000',
  pagosExistentes: [],
  estadoVenta: 'ACTIVA',
  fechaVenta: new Date('2026-01-15'),
  ...over,
});

describe('regla del area minima (1000 m2)', () => {
  it('acepta el area minima exacta', () => {
    expect(() => assertAreaMinima(1000)).not.toThrow();
  });

  /* Esta regla estaba en el documento pero era inaplicable en el v0:
     el formulario de lotes no tenia campo de area. */
  it('rechaza lotes menores a 1000 m2', () => {
    expect(() => assertAreaMinima(999)).toThrow(ErrorReglaNegocio);
    expect(() => assertAreaMinima(500)).toThrow(/1000 m2/);
  });

  it('respeta un minimo configurado por proyecto', () => {
    expect(() => assertAreaMinima(800, 750)).not.toThrow();
    expect(() => assertAreaMinima(700, 750)).toThrow(ErrorReglaNegocio);
  });

  it('rechaza areas no positivas', () => {
    expect(() => assertAreaMinima(0)).toThrow(ErrorReglaNegocio);
    expect(() => assertAreaMinima(-100)).toThrow(ErrorReglaNegocio);
    expect(() => assertAreaMinima(Number.NaN)).toThrow(ErrorReglaNegocio);
  });
});

describe('reglas de lote', () => {
  it('exige precio positivo', () => {
    expect(() => assertPrecioValido('85000000')).not.toThrow();
    expect(() => assertPrecioValido('0')).toThrow(ErrorReglaNegocio);
    expect(() => assertPrecioValido('-100')).toThrow(ErrorReglaNegocio);
  });

  it('impide editar un lote comprometido', () => {
    expect(() => assertLoteEditable('DISPONIBLE')).not.toThrow();
    expect(() => assertLoteEditable('VENDIDO')).toThrow(ErrorReglaNegocio);
    expect(() => assertLoteEditable('PAGADO')).toThrow(ErrorReglaNegocio);
  });

  /* Regresion: el v0 no tenia esta guarda y permitia doble venta. */
  it('impide vender un lote no disponible', () => {
    expect(() => assertLoteVendible('DISPONIBLE', 'MZ-A01')).not.toThrow();
    expect(() => assertLoteVendible('RESERVADO', 'MZ-A01')).not.toThrow();
    expect(() => assertLoteVendible('VENDIDO', 'MZ-A01')).toThrow(/MZ-A01/);
    expect(() => assertLoteVendible('BLOQUEADO', 'MZ-A01')).toThrow(ErrorReglaNegocio);
  });
});

describe('reglas de pago', () => {
  it('acepta un pago valido dentro del saldo', () => {
    expect(() =>
      assertPagoValido(
        { monto: '25500000', fecha: new Date('2026-02-01'), tipo: 'CUOTA_INICIAL' },
        ctx(), HOY,
      ),
    ).not.toThrow();
  });

  it('rechaza un pago mayor al saldo pendiente', () => {
    expect(() =>
      assertPagoValido(
        { monto: '90000000', fecha: new Date('2026-02-01'), tipo: 'ABONO' },
        ctx(), HOY,
      ),
    ).toThrow(/excede el saldo pendiente/);
  });

  /* Las cuatro reglas siguientes no existian en el v0. */
  it('rechaza un pago con fecha futura', () => {
    expect(() =>
      assertPagoValido(
        { monto: '1000000', fecha: new Date('2027-01-01'), tipo: 'ABONO' },
        ctx(), HOY,
      ),
    ).toThrow(/fecha futura/);
  });

  it('rechaza un pago anterior a la fecha de venta', () => {
    expect(() =>
      assertPagoValido(
        { monto: '1000000', fecha: new Date('2025-12-01'), tipo: 'ABONO' },
        ctx(), HOY,
      ),
    ).toThrow(/anterior a la fecha de la venta/);
  });

  it('rechaza un monto cero o negativo', () => {
    expect(() =>
      assertPagoValido({ monto: '0', fecha: new Date('2026-02-01'), tipo: 'ABONO' }, ctx(), HOY),
    ).toThrow(/mayor que cero/);
  });

  it('rechaza pagos sobre una venta anulada', () => {
    expect(() =>
      assertPagoValido(
        { monto: '1000000', fecha: new Date('2026-02-01'), tipo: 'ABONO' },
        ctx({ estadoVenta: 'ANULADA' }), HOY,
      ),
    ).toThrow(/venta anulada/);
  });

  it('rechaza pagos sobre una venta ya liquidada', () => {
    const pagos: PagoVigente[] = [
      { id: 'p1', monto: '85000000', fecha: new Date('2026-02-01'), tipo: 'PAGO_FINAL', anulado: false },
    ];
    expect(() =>
      assertPagoValido(
        { monto: '1', fecha: new Date('2026-03-01'), tipo: 'ABONO' },
        ctx({ pagosExistentes: pagos }), HOY,
      ),
    ).toThrow(/ya esta totalmente pagada/);
  });

  it('permite pagar justo el saldo restante', () => {
    const pagos: PagoVigente[] = [
      { id: 'p1', monto: '25500000', fecha: new Date('2026-01-15'), tipo: 'CUOTA_INICIAL', anulado: false },
    ];
    expect(() =>
      assertPagoValido(
        { monto: '59500000', fecha: new Date('2026-06-01'), tipo: 'PAGO_FINAL' },
        ctx({ pagosExistentes: pagos }), HOY,
      ),
    ).not.toThrow();
  });

  it('exige motivo para anular un pago', () => {
    expect(() => assertPagoAnulable({ anulado: false }, 'Error de digitacion del cajero')).not.toThrow();
    expect(() => assertPagoAnulable({ anulado: false }, 'error')).toThrow(/minimo 10 caracteres/);
    expect(() => assertPagoAnulable({ anulado: true }, 'Motivo suficientemente largo')).toThrow(/ya se encuentra anulado/);
  });
});

describe('reglas de cliente', () => {
  it('no elimina clientes con ventas vigentes', () => {
    expect(() => assertClienteEliminable(0)).not.toThrow();
    expect(() => assertClienteEliminable(2)).toThrow(/2 venta\(s\) vigente/);
  });

  it('valida y normaliza el documento', () => {
    expect(() => assertDocumentoValido('1234567890')).not.toThrow();
    expect(() => assertDocumentoValido('1.234.567.890')).not.toThrow();
    expect(() => assertDocumentoValido('123')).toThrow(ErrorReglaNegocio);
    expect(() => assertDocumentoValido('abc123456')).toThrow(ErrorReglaNegocio);

    // Detecta el duplicado que el v0 no veia: "1.234.567" vs "1234567".
    expect(normalizarDocumento('1.234.567')).toBe('1234567');
    expect(normalizarDocumento('1 234 567')).toBe('1234567');
    expect(normalizarDocumento('1-234-567')).toBe('1234567');
  });
});

describe('reglas de venta', () => {
  it('rechaza fecha de venta futura', () => {
    expect(() => assertFechaVentaValida(new Date('2026-01-15'), HOY)).not.toThrow();
    expect(() => assertFechaVentaValida(new Date('2027-01-15'), HOY)).toThrow(/futura/);
  });
});
