/* ==========================================================================
   Enumeraciones del dominio
   --------------------------------------------------------------------------
   En el sistema v0 los estados eran strings literales escritos a mano en 16
   lugares distintos ("Vendido", "vendido", "VENDIDO"), con normalizacion
   defensiva en lotesStorage.js. Aqui son la unica fuente de verdad: el
   schema de Prisma, los DTO de la API y la UI derivan todos de este archivo.
   ========================================================================== */

export const Rol = {
  ADMIN: 'ADMIN',
  SECRETARIA: 'SECRETARIA',
  EMPLEADO: 'EMPLEADO',
} as const;
export type Rol = (typeof Rol)[keyof typeof Rol];

export const EstadoProyecto = {
  ACTIVO: 'ACTIVO',
  PAUSADO: 'PAUSADO',
  CERRADO: 'CERRADO',
} as const;
export type EstadoProyecto = (typeof EstadoProyecto)[keyof typeof EstadoProyecto];

export const EstadoLote = {
  DISPONIBLE: 'DISPONIBLE',
  RESERVADO: 'RESERVADO',
  VENDIDO: 'VENDIDO',
  PAGADO: 'PAGADO',
  BLOQUEADO: 'BLOQUEADO',
} as const;
export type EstadoLote = (typeof EstadoLote)[keyof typeof EstadoLote];

export const EstadoVenta = {
  ACTIVA: 'ACTIVA',
  LIQUIDADA: 'LIQUIDADA',
  ANULADA: 'ANULADA',
} as const;
export type EstadoVenta = (typeof EstadoVenta)[keyof typeof EstadoVenta];

export const TipoPago = {
  CUOTA_INICIAL: 'CUOTA_INICIAL',
  ABONO: 'ABONO',
  PAGO_FINAL: 'PAGO_FINAL',
} as const;
export type TipoPago = (typeof TipoPago)[keyof typeof TipoPago];

export const MetodoPago = {
  EFECTIVO: 'EFECTIVO',
  TRANSFERENCIA: 'TRANSFERENCIA',
  CHEQUE: 'CHEQUE',
  CONSIGNACION: 'CONSIGNACION',
} as const;
export type MetodoPago = (typeof MetodoPago)[keyof typeof MetodoPago];

export const TipoDocumento = {
  CC: 'CC',
  CE: 'CE',
  NIT: 'NIT',
  PASAPORTE: 'PASAPORTE',
} as const;
export type TipoDocumento = (typeof TipoDocumento)[keyof typeof TipoDocumento];

/** Estado de cartera de una venta. Derivado del saldo, nunca almacenado. */
export const EstadoCartera = {
  PENDIENTE: 'PENDIENTE',
  PARCIAL: 'PARCIAL',
  PAGADO: 'PAGADO',
  EN_MORA: 'EN_MORA',
} as const;
export type EstadoCartera = (typeof EstadoCartera)[keyof typeof EstadoCartera];

/* -------------------------------------------------------------------------
   Etiquetas para la interfaz. Centralizadas para que un estado no se
   muestre como "Pagado" en una pantalla y "PAGADO" en otra.
   ------------------------------------------------------------------------- */

export const ETIQUETA_ESTADO_LOTE: Record<EstadoLote, string> = {
  DISPONIBLE: 'Disponible',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
  PAGADO: 'Pagado',
  BLOQUEADO: 'Bloqueado',
};

export const ETIQUETA_ESTADO_VENTA: Record<EstadoVenta, string> = {
  ACTIVA: 'Activa',
  LIQUIDADA: 'Liquidada',
  ANULADA: 'Anulada',
};

export const ETIQUETA_TIPO_PAGO: Record<TipoPago, string> = {
  CUOTA_INICIAL: 'Cuota inicial',
  ABONO: 'Abono',
  PAGO_FINAL: 'Pago final',
};

export const ETIQUETA_METODO_PAGO: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  CONSIGNACION: 'Consignacion',
};

export const ETIQUETA_ESTADO_CARTERA: Record<EstadoCartera, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Abonado',
  PAGADO: 'Pagado',
  EN_MORA: 'En mora',
};

export const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  SECRETARIA: 'Secretaria',
  EMPLEADO: 'Empleado',
};

export const ETIQUETA_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  CC: 'Cedula de ciudadania',
  CE: 'Cedula de extranjeria',
  NIT: 'NIT',
  PASAPORTE: 'Pasaporte',
};
