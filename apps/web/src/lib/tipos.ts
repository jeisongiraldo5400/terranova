import type {
  EstadoLote, EstadoProyecto, EstadoVenta, MetodoPago, Permiso, Rol, TipoDocumento, TipoPago,
} from '@terranova/shared';

export interface UsuarioSesion {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  permisos: Permiso[];
  modulos: string[];
}

export interface Pagina<T> {
  datos: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

export interface ProyectoResumen {
  proyecto_id: string;
  codigo: string;
  nombre: string;
  estado: string;
  total_lotes: number;
  lotes_disponibles: number;
  lotes_reservados: number;
  lotes_vendidos: number;
  lotes_pagados: number;
  area_total_m2: string;
  valor_inventario: string;
  valor_vendido: string;
  recaudado: string;
  por_cobrar: string;
  en_mora: string;
  total_ventas: number;
  ventas_pagadas: number;
  ventas_en_mora: number;
  total_clientes: number;
}

export interface Lote {
  id: string;
  proyectoId: string;
  etapaId: string | null;
  codigo: string;
  areaM2: string;
  precioLista: string;
  estado: EstadoLote;
  observaciones: string | null;
  proyecto: { id: string; codigo: string; nombre: string };
  etapa: { id: string; numero: number; nombre: string } | null;
  ventas: Array<{
    id: string;
    numero: number;
    precioNegociado: string;
    fechaVenta: string;
    cliente: { id: string; documento: string; nombre: string };
  }>;
}

export interface Cliente {
  id: string;
  tipoDocumento: TipoDocumento;
  documento: string;
  nombre: string;
  telefono: string;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  observaciones: string | null;
  activo: boolean;
  _count?: { ventas: number };
}

export interface Proyecto {
  id: string;
  codigo: string;
  nombre: string;
  ubicacion: string | null;
  estado: EstadoProyecto;
  areaMinimaM2: string;
  observaciones: string | null;
  etapas: Array<{ id: string; numero: number; nombre: string; _count?: { lotes: number } }>;
}

export interface UsuarioSistema {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  ultimoAcceso: string | null;
  creadoEn: string;
}

export interface RegistroAuditoria {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  antes: unknown;
  despues: unknown;
  ip: string | null;
  creadoEn: string;
  usuario: { nombre: string; email: string; rol: Rol } | null;
}

export type EstadoCartera = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'EN_MORA' | 'ANULADA';

export interface VentaCuenta {
  venta_id: string;
  venta_numero: number;
  estado_venta: EstadoVenta;
  fecha_venta: string;
  precio_negociado: string;
  lote_id: string;
  lote_codigo: string;
  area_m2: string;
  proyecto_id: string;
  proyecto_nombre: string;
  cliente_id: string;
  cliente_documento: string;
  cliente_nombre: string;
  total_pagado: string;
  saldo: string;
  cantidad_pagos: number;
  ultimo_pago: string | null;
  porcentaje_pagado: string;
  total_en_mora: string;
  dias_mora_maximo: number | null;
  estado_cartera: EstadoCartera;
}

export interface Pago {
  id: string;
  ventaId: string;
  tipo: TipoPago;
  monto: string;
  fecha: string;
  metodo: MetodoPago;
  referencia: string | null;
  concepto: string | null;
  anulado: boolean;
  motivoAnulacion: string | null;
  venta?: {
    numero: number;
    lote: { codigo: string; proyecto: { nombre: string } };
    cliente: { documento: string; nombre: string };
  };
  registradoPor?: { nombre: string };
  anuladoPor?: { nombre: string } | null;
}

export interface Contrato {
  id: string;
  ventaId: string;
  numero: string;
  version: number;
  sha256: string;
  bytes: number;
  generadoEn: string;
  venta?: {
    numero: number;
    fechaVenta: string;
    precioNegociado: string;
    estado: string;
    lote: { codigo: string; proyecto: { nombre: string } };
    cliente: { documento: string; nombre: string };
  };
  generadoPor?: { nombre: string };
}

export interface Dashboard {
  inventario: Array<{ estado: EstadoLote; cantidad: number; valor: string; area: string }>;
  cartera: {
    valor_vendido: string;
    recaudado: string;
    por_cobrar: string;
    en_mora: string;
    ventas: number;
  };
  recaudoMensual: Array<{ mes: string; recaudado: string; pagos: number }>;
  proximosVencimientos: Array<{
    venta_id: string; numero: number; descripcion: string; monto_pendiente: string;
    fecha_vencimiento: string; cliente_nombre: string; lote_codigo: string; proyecto_nombre: string;
  }>;
  mora: Array<{
    venta_id: string; venta_numero: number; cliente_nombre: string; cliente_documento: string;
    lote_codigo: string; proyecto_nombre: string; saldo: string; total_en_mora: string;
    dias_mora_maximo: number;
  }>;
}
