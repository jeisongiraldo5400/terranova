/* Presentacion. El calculo vive en @terranova/shared; aqui solo se pinta. */

export { formatearCOP, formatearCifra } from '@terranova/shared';

const FECHA_CORTA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
});

const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

/**
 * Las fechas de negocio llegan como "YYYY-MM-DD" y se muestran en UTC a
 * proposito: son dias calendario, no instantes. Interpretarlas en la hora
 * local del navegador las correria un dia hacia atras en Colombia.
 */
export const fechaCorta = (iso: string | null | undefined): string =>
  iso ? FECHA_CORTA.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : '—';

export const fechaLarga = (iso: string | null | undefined): string =>
  iso ? FECHA_LARGA.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : '—';

export const area = (m2: string | number): string =>
  `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(m2))} m²`;

export const porcentaje = (v: string | number): string =>
  `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(Number(v))}%`;

/** Una venta tal como se ofrece en un selector: "#12 · MZ-A01 · Ana Ruiz". */
export interface OpcionVenta {
  id: string;
  etiqueta: string;
  saldo: string;
}

export const opcionVenta = (v: {
  venta_id: string; venta_numero: number; lote_codigo: string; cliente_nombre: string; saldo: string;
}): OpcionVenta => ({
  id: v.venta_id,
  etiqueta: `#${v.venta_numero} · ${v.lote_codigo} · ${v.cliente_nombre}`,
  saldo: v.saldo,
});
