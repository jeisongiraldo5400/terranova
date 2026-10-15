/* ==========================================================================
   Cliente de base de datos
   ========================================================================== */

export { PrismaClient, Prisma } from '../generated/client/index.js';
export type {
  Usuario, RefreshToken, Proyecto, Etapa, Lote, Cliente,
  Venta, PlanPago, Cuota, Pago, Contrato, ConfiguracionEmpresa, AuditLog,
} from '../generated/client/index.js';

export * from './tipos-vista.js';
export * from './decimal.js';
