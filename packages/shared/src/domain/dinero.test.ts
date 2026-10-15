import { describe, expect, it } from 'vitest';
import {
  dinero, dineroDesdeTexto, sumar, restar, repartir, esCero, esMayor,
  formatearCOP, formatearCifra, porcentaje, restarSinNegativos, aTexto, comparar,
} from './dinero.js';

describe('dinero (parser estricto)', () => {
  it('acepta formato canonico y numeros', () => {
    expect(aTexto(dinero('85000000.50'))).toBe('85000000.50');
    expect(aTexto(dinero('85000000'))).toBe('85000000.00');
    expect(aTexto(dinero(85_000_000))).toBe('85000000.00');
    expect(aTexto(dinero(''))).toBe('0.00');
  });

  /* El punto es SIEMPRE decimal aqui. "10.005" es diez con cinco milesimas,
     no diez mil cinco: la funcion no adivina convenciones. */
  it('trata el punto como separador decimal, sin adivinar', () => {
    expect(aTexto(dinero('10.005'))).toBe('10.00'); // ROUND_HALF_EVEN
    expect(aTexto(dinero('10.015'))).toBe('10.02');
  });

  it('rechaza separadores de miles en lugar de interpretarlos mal', () => {
    expect(() => dinero('85.000.000')).toThrow(/dineroDesdeTexto/);
    expect(() => dinero('85.000.000,50')).toThrow(RangeError);
    expect(() => dinero('$ 85000000')).toThrow(RangeError);
  });

  it('rechaza entradas no numericas', () => {
    expect(() => dinero('abc')).toThrow(RangeError);
    expect(() => dinero(Number.NaN)).toThrow(RangeError);
    expect(() => dinero(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('dineroDesdeTexto (entrada de formulario, convencion colombiana)', () => {
  it('interpreta el punto como separador de miles', () => {
    expect(aTexto(dineroDesdeTexto('85.000.000'))).toBe('85000000.00');
    expect(aTexto(dineroDesdeTexto('1.500'))).toBe('1500.00');
    // Declarada la convencion, "10.005" ya no es ambiguo.
    expect(aTexto(dineroDesdeTexto('10.005'))).toBe('10005.00');
  });

  it('interpreta la coma como separador decimal', () => {
    expect(aTexto(dineroDesdeTexto('85.000.000,50'))).toBe('85000000.50');
    expect(aTexto(dineroDesdeTexto('1500,75'))).toBe('1500.75');
  });

  it('tolera el simbolo de moneda y los espacios', () => {
    expect(aTexto(dineroDesdeTexto('$ 85.000.000'))).toBe('85000000.00');
    expect(aTexto(dineroDesdeTexto('  1.500  '))).toBe('1500.00');
  });

  it('acepta cifras sin separadores', () => {
    expect(aTexto(dineroDesdeTexto('1500'))).toBe('1500.00');
  });

  /* Un punto seguido de 1 o 2 digitos no puede ser separador de miles
     (los grupos llevan tres cifras), de modo que se lee como decimal.
     Es lo que envia cualquier cliente de la API y lo que escribe quien
     teclea centavos. */
  it('interpreta un punto con 1 o 2 decimales como separador decimal', () => {
    expect(aTexto(dineroDesdeTexto('30000000.01'))).toBe('30000000.01');
    expect(aTexto(dineroDesdeTexto('1500.5'))).toBe('1500.50');
    expect(aTexto(dineroDesdeTexto('0.99'))).toBe('0.99');
  });

  it('sigue tratando los grupos de tres digitos como miles', () => {
    expect(aTexto(dineroDesdeTexto('30.000.000'))).toBe('30000000.00');
    expect(aTexto(dineroDesdeTexto('10.005'))).toBe('10005.00');
  });

  it('rechaza texto que no contiene cifras', () => {
    expect(() => dineroDesdeTexto('abc')).toThrow(RangeError);
    expect(() => dineroDesdeTexto('')).toThrow(RangeError);
  });

  it('ida y vuelta con el formato de presentacion', () => {
    const original = dinero('85000000');
    expect(aTexto(dineroDesdeTexto(formatearCifra(original)))).toBe('85000000.00');
  });
});

describe('aritmetica exacta', () => {
  /* ----------------------------------------------------------------------
     REGRESION del bug principal del v0 (Pagos.jsx:433).
     Con punto flotante: 0.1 + 0.2 - 0.3 === 5.55e-17, y el `saldo === 0`
     que decidia si una venta estaba pagada nunca se cumplia.
     ---------------------------------------------------------------------- */
  it('no acumula error de punto flotante', () => {
    expect(0.1 + 0.2 === 0.3).toBe(false); // el bug, demostrado
    expect(esCero(restar(sumar('0.1', '0.2'), '0.3'))).toBe(true); // corregido
  });

  it('un lote de 85.000.000 en tres abonos iguales queda en saldo cero', () => {
    const precio = dinero('85000000');
    const [a, b, c] = repartir(precio, 3);

    // Con floats, 85000000/3 deja residuo y el saldo nunca llega a cero.
    const saldo = restar(precio, sumar(a!, b!, c!));
    expect(esCero(saldo)).toBe(true);
    expect(aTexto(saldo)).toBe('0.00');
  });

  it('restarSinNegativos trunca en cero', () => {
    expect(aTexto(restarSinNegativos('100', '150'))).toBe('0.00');
    expect(aTexto(restarSinNegativos('150', '100'))).toBe('50.00');
  });

  it('calcula porcentajes sin desviacion', () => {
    expect(aTexto(porcentaje('85000000', 30))).toBe('25500000.00');
    expect(aTexto(porcentaje('1000', 33.33))).toBe('333.30');
  });

  it('compara para ordenar columnas de dinero', () => {
    expect(comparar('100', '200')).toBe(-1);
    expect(comparar('200', '100')).toBe(1);
    expect(comparar('100.00', '100')).toBe(0);
    expect(esMayor('100.01', '100')).toBe(true);
  });
});

describe('repartir', () => {
  it('reparte sin perder centavos', () => {
    const partes = repartir('100', 3);
    expect(partes.map(aTexto)).toEqual(['33.34', '33.33', '33.33']);
    expect(aTexto(sumar(...partes))).toBe('100.00');
  });

  it('cuadra para cualquier numero de cuotas', () => {
    for (const n of [1, 2, 3, 6, 7, 12, 24, 36]) {
      const partes = repartir('85000000', n);
      expect(partes).toHaveLength(n);
      expect(aTexto(sumar(...partes))).toBe('85000000.00');
    }
  });

  it('rechaza un numero de partes invalido', () => {
    expect(() => repartir('100', 0)).toThrow(RangeError);
    expect(() => repartir('100', 2.5)).toThrow(RangeError);
  });
});

describe('formato', () => {
  it('formatea en pesos colombianos sin centavos', () => {
    const texto = formatearCOP('85000000');
    expect(texto).toContain('85.000.000');
    expect(texto).not.toContain(',00');
  });

  it('muestra centavos solo cuando existen', () => {
    expect(formatearCOP('85000000.50')).toContain('85.000.000,50');
  });

  it('formatea cifras sin simbolo para celdas de tabla', () => {
    expect(formatearCifra('85000000')).toBe('85.000.000');
  });
});
