import { describe, expect, it } from 'vitest';
import { dineroSchema, fechaSchema, areaM2Schema, codigoSchema, documentoSchema } from './comunes.js';

describe('fechaSchema', () => {
  /* ----------------------------------------------------------------------
     REGRESION: con setHours() local, "2026-09-01" se guardaba como
     2026-08-31 en cualquier zona con desplazamiento negativo (Bogota es
     UTC-5). Una venta registrada el 1 de septiembre quedaba fechada el 31
     de agosto, y el plan de pagos heredaba el corrimiento: la cuota
     inicial vencia un dia antes de la venta.
     ---------------------------------------------------------------------- */
  it('conserva el dia calendario sin importar la zona horaria', () => {
    const d = fechaSchema.parse('2026-09-01');
    expect(d.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(d.toISOString().slice(0, 10)).toBe('2026-09-01');
  });

  it('normaliza a medianoche UTC descartando la hora', () => {
    expect(fechaSchema.parse('2026-09-01T18:45:33.123Z').toISOString())
      .toBe('2026-09-01T00:00:00.000Z');
  });

  it('acepta el primero y el ultimo dia del ano sin corrimiento', () => {
    expect(fechaSchema.parse('2026-01-01').toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(fechaSchema.parse('2026-12-31').toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('rechaza fechas invalidas', () => {
    expect(() => fechaSchema.parse('no-es-fecha')).toThrow();
  });
});

describe('dineroSchema', () => {
  it('interpreta el formato colombiano de los formularios', () => {
    expect(dineroSchema.parse('120.000.000')).toBe('120000000.00');
    expect(dineroSchema.parse('85.000.000,50')).toBe('85000000.50');
    expect(dineroSchema.parse('$ 1.500')).toBe('1500.00');
  });

  it('toma los numeros tal cual', () => {
    expect(dineroSchema.parse(120_000_000)).toBe('120000000.00');
  });

  it('siempre devuelve string canonico, nunca number', () => {
    const v = dineroSchema.parse('120.000.000');
    expect(typeof v).toBe('string');
  });

  it('rechaza texto sin cifras', () => {
    expect(() => dineroSchema.parse('abc')).toThrow();
  });
});

describe('areaM2Schema', () => {
  it('aplica la regla de los 1000 m2', () => {
    expect(areaM2Schema.parse(1000)).toBe(1000);
    expect(areaM2Schema.parse('1200')).toBe(1200);
    expect(() => areaM2Schema.parse(999)).toThrow(/1000 m2/);
  });
});

describe('codigoSchema', () => {
  it('normaliza a mayusculas sin espacios', () => {
    expect(codigoSchema.parse('mz-a 01')).toBe('MZ-A01');
    expect(codigoSchema.parse('  mir-02  ')).toBe('MIR-02');
  });

  it('rechaza caracteres no permitidos', () => {
    expect(() => codigoSchema.parse('MZ_A#01')).toThrow();
  });
});

describe('documentoSchema', () => {
  it('normaliza separadores para detectar duplicados', () => {
    expect(documentoSchema.parse('1.234.567')).toBe('1234567');
    expect(documentoSchema.parse('1-234-567')).toBe('1234567');
  });
});
