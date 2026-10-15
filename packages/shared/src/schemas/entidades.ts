/* ==========================================================================
   Esquemas de las entidades del negocio
   ========================================================================== */

import { z } from 'zod';
import {
  EstadoLote,
  EstadoProyecto,
  MetodoPago,
  Rol,
  TipoDocumento,
  TipoPago,
} from '../enums/index.js';
import {
  areaM2Schema,
  codigoSchema,
  dineroPositivoSchema,
  documentoSchema,
  emailSchema,
  fechaNoFuturaSchema,
  fechaSchema,
  idSchema,
  motivoSchema,
  nombreSchema,
  observacionesSchema,
  paginacionSchema,
  telefonoSchema,
} from './comunes.js';

/**
 * Los enums del dominio son objetos `as const`, por lo que z.nativeEnum
 * conserva el tipo literal de la union. Con z.enum(Object.values(...)) el
 * tipo se degrada a `string` y Prisma rechaza el valor al compilar.
 */
const enumDe = z.nativeEnum;

/* --------------------------------------------------------------------------
   Autenticacion
   -------------------------------------------------------------------------- */

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contrasena es obligatoria'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Reemplaza el `admin`/`1234` en texto plano del v0. */
export const passwordSchema = z
  .string()
  .min(10, 'Minimo 10 caracteres')
  .max(128, 'Maximo 128 caracteres')
  .refine((v) => /[a-z]/.test(v), 'Debe incluir una minuscula')
  .refine((v) => /[A-Z]/.test(v), 'Debe incluir una mayuscula')
  .refine((v) => /\d/.test(v), 'Debe incluir un numero');

export const crearUsuarioSchema = z.object({
  email: emailSchema,
  nombre: nombreSchema,
  password: passwordSchema,
  rol: enumDe(Rol),
});
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export const cambiarPasswordSchema = z
  .object({
    passwordActual: z.string().min(1),
    passwordNueva: passwordSchema,
    confirmacion: z.string(),
  })
  .refine((d) => d.passwordNueva === d.confirmacion, {
    message: 'Las contrasenas no coinciden',
    path: ['confirmacion'],
  });

/* --------------------------------------------------------------------------
   Proyectos y etapas
   -------------------------------------------------------------------------- */

export const crearProyectoSchema = z.object({
  codigo: codigoSchema,
  nombre: nombreSchema,
  ubicacion: z.string().trim().max(200).optional().nullable(),
  estado: enumDe(EstadoProyecto).default(EstadoProyecto.ACTIVO),
  areaMinimaM2: z.coerce.number().positive().default(1000),
  observaciones: observacionesSchema,
});
export type CrearProyectoInput = z.infer<typeof crearProyectoSchema>;

export const actualizarProyectoSchema = crearProyectoSchema.partial().omit({ codigo: true });

export const crearEtapaSchema = z.object({
  proyectoId: idSchema,
  numero: z.coerce.number().int().min(1).max(100),
  nombre: z.string().trim().min(1).max(80),
});

/* --------------------------------------------------------------------------
   Lotes
   -------------------------------------------------------------------------- */

export const crearLoteSchema = z.object({
  proyectoId: idSchema,
  etapaId: idSchema.optional().nullable(),
  codigo: codigoSchema,
  // Campo ausente por completo en el v0, lo que hacia inaplicable la regla
  // de los 1000 m2 del documento original.
  areaM2: areaM2Schema,
  precioLista: dineroPositivoSchema,
  observaciones: observacionesSchema,
});
export type CrearLoteInput = z.infer<typeof crearLoteSchema>;

export const actualizarLoteSchema = crearLoteSchema
  .partial()
  .omit({ proyectoId: true })
  .extend({ estado: enumDe(EstadoLote).optional() });

export const filtroLotesSchema = paginacionSchema.extend({
  proyectoId: idSchema.optional(),
  etapaId: idSchema.optional(),
  estado: enumDe(EstadoLote).optional(),
  buscar: z.string().trim().max(100).optional(),
  areaMin: z.coerce.number().positive().optional(),
  areaMax: z.coerce.number().positive().optional(),
});
export type FiltroLotes = z.infer<typeof filtroLotesSchema>;

export const crearLotesEnLoteSchema = z.object({
  proyectoId: idSchema,
  etapaId: idSchema.optional().nullable(),
  prefijo: codigoSchema,
  desde: z.coerce.number().int().min(1),
  hasta: z.coerce.number().int().min(1).max(999),
  areaM2: areaM2Schema,
  precioLista: dineroPositivoSchema,
}).refine((d) => d.hasta >= d.desde, {
  message: 'El numero final debe ser mayor o igual al inicial',
  path: ['hasta'],
});

/* --------------------------------------------------------------------------
   Clientes
   -------------------------------------------------------------------------- */

export const crearClienteSchema = z.object({
  tipoDocumento: enumDe(TipoDocumento).default(TipoDocumento.CC),
  documento: documentoSchema,
  nombre: nombreSchema,
  telefono: telefonoSchema,
  email: emailSchema.optional().nullable(),
  direccion: z.string().trim().max(200).optional().nullable(),
  ciudad: z.string().trim().max(80).optional().nullable(),
  observaciones: observacionesSchema,
});
export type CrearClienteInput = z.infer<typeof crearClienteSchema>;

export const actualizarClienteSchema = crearClienteSchema.partial();

export const filtroClientesSchema = paginacionSchema.extend({
  buscar: z.string().trim().max(100).optional(),
  activo: z.coerce.boolean().optional(),
  // Clientes que compraron en un proyecto. En el v0 el cliente estaba
  // atado al proyecto y se duplicaba si compraba en dos.
  proyectoId: idSchema.optional(),
});

/* --------------------------------------------------------------------------
   Ventas
   -------------------------------------------------------------------------- */

export const modalidadPlanSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('DOS_PAGOS'),
    fechaLimitePagoFinal: fechaSchema,
  }),
  z.object({
    tipo: z.literal('CUOTAS'),
    numeroCuotas: z.coerce.number().int().min(1).max(240),
    diaPago: z.coerce.number().int().min(1).max(31).optional(),
  }),
]);

export const registrarVentaSchema = z
  .object({
    loteId: idSchema,
    clienteId: idSchema,
    // El precio se negocia con cada cliente (regla del documento), por lo
    // que es independiente del precio de lista del lote.
    precioNegociado: dineroPositivoSchema,
    fechaVenta: fechaNoFuturaSchema,
    cuotaInicial: dineroPositivoSchema.optional(),
    porcentajeInicial: z.coerce.number().min(0).max(100).optional(),
    modalidad: modalidadPlanSchema,
    observaciones: observacionesSchema,
  })
  .refine((d) => d.cuotaInicial !== undefined || d.porcentajeInicial !== undefined, {
    message: 'Indique el monto o el porcentaje de la cuota inicial',
    path: ['cuotaInicial'],
  });
export type RegistrarVentaInput = z.infer<typeof registrarVentaSchema>;

export const anularVentaSchema = z.object({
  motivo: motivoSchema,
  /** Si es true, anula tambien los pagos asociados. */
  anularPagos: z.boolean().default(true),
});

export const filtroVentasSchema = paginacionSchema.extend({
  proyectoId: idSchema.optional(),
  clienteId: idSchema.optional(),
  estado: z.enum(['ACTIVA', 'LIQUIDADA', 'ANULADA']).optional(),
  estadoCartera: z.enum(['PENDIENTE', 'PARCIAL', 'PAGADO', 'EN_MORA']).optional(),
  buscar: z.string().trim().max(100).optional(),
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional(),
});

/* --------------------------------------------------------------------------
   Pagos
   -------------------------------------------------------------------------- */

export const registrarPagoSchema = z.object({
  ventaId: idSchema,
  cuotaId: idSchema.optional().nullable(),
  tipo: enumDe(TipoPago),
  monto: dineroPositivoSchema,
  // El v0 no validaba la fecha: aceptaba pagos futuros y anteriores a la venta.
  fecha: fechaNoFuturaSchema,
  metodo: enumDe(MetodoPago),
  referencia: z.string().trim().max(60).optional().nullable(),
  concepto: z.string().trim().max(200).optional().nullable(),
});
export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>;

/** Los pagos no se eliminan: se anulan dejando rastro y motivo. */
export const anularPagoSchema = z.object({ motivo: motivoSchema });

export const filtroPagosSchema = paginacionSchema.extend({
  proyectoId: idSchema.optional(),
  ventaId: idSchema.optional(),
  clienteId: idSchema.optional(),
  tipo: enumDe(TipoPago).optional(),
  metodo: enumDe(MetodoPago).optional(),
  incluirAnulados: z.coerce.boolean().default(false),
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional(),
});

/* --------------------------------------------------------------------------
   Contratos
   -------------------------------------------------------------------------- */

export const generarContratoSchema = z.object({
  ventaId: idSchema,
  /** Fuerza una version nueva en lugar de devolver la existente. */
  regenerar: z.boolean().default(false),
});

/* --------------------------------------------------------------------------
   Configuracion
   -------------------------------------------------------------------------- */

export const configuracionEmpresaSchema = z.object({
  razonSocial: nombreSchema,
  nit: documentoSchema,
  direccion: z.string().trim().min(5).max(200),
  ciudad: z.string().trim().min(2).max(80),
  telefono: telefonoSchema,
  email: emailSchema,
  representanteLegal: nombreSchema,
  documentoRepresentante: documentoSchema,
  /** Texto de clausulas que se inserta en el contrato generado. */
  clausulasContrato: z.string().max(20_000).optional().nullable(),
});
export type ConfiguracionEmpresaInput = z.infer<typeof configuracionEmpresaSchema>;

/* --------------------------------------------------------------------------
   Reportes
   -------------------------------------------------------------------------- */

export const filtroReporteSchema = z.object({
  proyectoId: idSchema.optional(),
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional(),
  fechaCorte: fechaSchema.optional(),
});
export type FiltroReporte = z.infer<typeof filtroReporteSchema>;

export const formatoExportacionSchema = z.enum(['csv', 'xlsx']);
