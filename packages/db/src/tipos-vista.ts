/* ==========================================================================
   Tipos de las vistas SQL
   --------------------------------------------------------------------------
   Prisma no genera tipos para vistas creadas por SQL crudo, asi que se
   declaran aqui. Reflejan prisma/sql/02-vistas.sql.
   ========================================================================== */

import type { EstadoLote, EstadoProyecto, EstadoVenta, TipoPago } from '@terranova/shared';

export type EstadoCarteraVista = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'EN_MORA' | 'ANULADA';

/** Fila de `venta_estado_cuenta`. Los montos llegan como Decimal de Postgres. */
export interface VentaEstadoCuentaRow {
  venta_id: string;
  venta_numero: number;
  estado_venta: EstadoVenta;
  fecha_venta: Date;
  precio_negociado: string;
  lote_id: string;
  lote_codigo: string;
  area_m2: string;
  proyecto_id: string;
  proyecto_codigo: string;
  proyecto_nombre: string;
  cliente_id: string;
  cliente_documento: string;
  cliente_nombre: string;
  total_pagado: string;
  saldo: string;
  excedente: string;
  cantidad_pagos: number;
  ultimo_pago: Date | null;
  porcentaje_pagado: string;
  total_en_mora: string;
  dias_mora_maximo: number | null;
  estado_cartera: EstadoCarteraVista;
}

/** Fila de `proyecto_resumen`. */
export interface ProyectoResumenRow {
  proyecto_id: string;
  codigo: string;
  nombre: string;
  estado: EstadoProyecto;
  total_lotes: bigint;
  lotes_disponibles: bigint;
  lotes_reservados: bigint;
  lotes_vendidos: bigint;
  lotes_pagados: bigint;
  area_total_m2: string;
  valor_inventario: string;
  valor_vendido: string;
  recaudado: string;
  por_cobrar: string;
  en_mora: string;
  total_ventas: bigint;
  ventas_pagadas: bigint;
  ventas_en_mora: bigint;
  total_clientes: bigint;
}

/** Fila de `cuota_estado`. */
export interface CuotaEstadoRow {
  cuota_id: string;
  venta_id: string;
  numero: number;
  tipo: TipoPago;
  monto_esperado: string;
  fecha_vencimiento: Date;
  descripcion: string;
  monto_cubierto: string;
  monto_pendiente: string;
  estado: 'PAGADA' | 'PARCIAL' | 'PENDIENTE' | 'EN_MORA';
  dias_vencida: number;
}

export interface ConteoPorEstadoLote {
  estado: EstadoLote;
  total: bigint;
}
