import { describe, expect, it } from 'vitest';
import {
  assertTransicionLote, assertTransicionVenta, esVendible, estaComprometido,
  estadoLoteSegunVenta, puedeTransicionarLote, puedeTransicionarVenta,
} from './estados.js';
import { ErrorTransicion } from './errores.js';

describe('maquina de estados del lote', () => {
  it('permite el recorrido normal de venta', () => {
    expect(puedeTransicionarLote('DISPONIBLE', 'RESERVADO')).toBe(true);
    expect(puedeTransicionarLote('RESERVADO', 'VENDIDO')).toBe(true);
    expect(puedeTransicionarLote('VENDIDO', 'PAGADO')).toBe(true);
  });

  it('permite vender directo sin reservar', () => {
    expect(puedeTransicionarLote('DISPONIBLE', 'VENDIDO')).toBe(true);
  });

  /* Regresion: el v0 permitia esta transicion con una asignacion directa. */
  it('impide vender un lote ya vendido', () => {
    expect(puedeTransicionarLote('VENDIDO', 'VENDIDO')).toBe(false);
    expect(() => assertTransicionLote('VENDIDO', 'PAGADO')).not.toThrow();
  });

  it('impide saltar de DISPONIBLE a PAGADO', () => {
    expect(puedeTransicionarLote('DISPONIBLE', 'PAGADO')).toBe(false);
    expect(() => assertTransicionLote('DISPONIBLE', 'PAGADO')).toThrow(ErrorTransicion);
  });

  /* Regresion: sin esta transicion, anular un pago de una venta ya
     liquidada fallaba con "Un lote en estado PAGADO no puede pasar a
     VENDIDO" y el cheque devuelto no se podia reversar. */
  it('devuelve el lote a VENDIDO al anular un pago de una venta liquidada', () => {
    expect(puedeTransicionarLote('PAGADO', 'VENDIDO')).toBe(true);
    expect(() => assertTransicionLote('PAGADO', 'VENDIDO')).not.toThrow();
  });

  it('sigue impidiendo reservar o bloquear un lote pagado', () => {
    expect(puedeTransicionarLote('PAGADO', 'RESERVADO')).toBe(false);
    expect(puedeTransicionarLote('PAGADO', 'BLOQUEADO')).toBe(false);
  });

  it('libera el lote al anular la venta', () => {
    expect(puedeTransicionarLote('VENDIDO', 'DISPONIBLE')).toBe(true);
    expect(puedeTransicionarLote('PAGADO', 'DISPONIBLE')).toBe(true);
  });

  it('acepta la transicion a si mismo como no-op', () => {
    expect(() => assertTransicionLote('VENDIDO', 'VENDIDO')).not.toThrow();
  });

  it('informa las transiciones permitidas en el error', () => {
    try {
      assertTransicionLote('PAGADO', 'RESERVADO');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorTransicion);
      expect((e as ErrorTransicion).detalles?.permitidas).toEqual(['VENDIDO', 'DISPONIBLE']);
    }
  });

  it('identifica lotes vendibles y comprometidos', () => {
    expect(esVendible('DISPONIBLE')).toBe(true);
    expect(esVendible('RESERVADO')).toBe(true);
    expect(esVendible('VENDIDO')).toBe(false);
    expect(esVendible('BLOQUEADO')).toBe(false);

    expect(estaComprometido('VENDIDO')).toBe(true);
    expect(estaComprometido('PAGADO')).toBe(true);
    expect(estaComprometido('DISPONIBLE')).toBe(false);
  });
});

describe('maquina de estados de la venta', () => {
  it('liquida una venta activa', () => {
    expect(puedeTransicionarVenta('ACTIVA', 'LIQUIDADA')).toBe(true);
  });

  it('permite reabrir una venta liquidada si se anula un pago', () => {
    expect(puedeTransicionarVenta('LIQUIDADA', 'ACTIVA')).toBe(true);
  });

  it('ANULADA es un estado terminal', () => {
    expect(puedeTransicionarVenta('ANULADA', 'ACTIVA')).toBe(false);
    expect(puedeTransicionarVenta('ANULADA', 'LIQUIDADA')).toBe(false);
    expect(() => assertTransicionVenta('ANULADA', 'ACTIVA')).toThrow(ErrorTransicion);
  });
});

describe('estado del lote derivado de la venta', () => {
  it('deriva el estado en lugar de almacenarlo por separado', () => {
    expect(estadoLoteSegunVenta('ACTIVA')).toBe('VENDIDO');
    expect(estadoLoteSegunVenta('LIQUIDADA')).toBe('PAGADO');
    expect(estadoLoteSegunVenta('ANULADA')).toBe('DISPONIBLE');
  });
});
