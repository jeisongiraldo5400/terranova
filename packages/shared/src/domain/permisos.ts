/* ==========================================================================
   Permisos por rol
   --------------------------------------------------------------------------
   El documento original define tres roles (Administrador, Secretaria,
   Empleado). En el v0 ninguno existia: Login.jsx comparaba contra
   `admin` / `1234` en texto plano y asignaba siempre rol Administrador.

   Esta matriz es la unica definicion de permisos. El guard de Nest la usa
   para autorizar la peticion y la UI la usa para ocultar lo que el usuario
   no puede hacer -- sin duplicar la regla.
   ========================================================================== */

import { Rol } from '../enums/index.js';

export const Permiso = {
  PROYECTO_VER: 'proyecto:ver',
  PROYECTO_GESTIONAR: 'proyecto:gestionar',

  LOTE_VER: 'lote:ver',
  LOTE_GESTIONAR: 'lote:gestionar',

  CLIENTE_VER: 'cliente:ver',
  CLIENTE_GESTIONAR: 'cliente:gestionar',

  VENTA_VER: 'venta:ver',
  VENTA_CREAR: 'venta:crear',
  VENTA_ANULAR: 'venta:anular',

  PAGO_VER: 'pago:ver',
  PAGO_CREAR: 'pago:crear',
  PAGO_ANULAR: 'pago:anular',

  CONTRATO_VER: 'contrato:ver',
  CONTRATO_GENERAR: 'contrato:generar',

  REPORTE_VER: 'reporte:ver',
  REPORTE_EXPORTAR: 'reporte:exportar',

  CONFIG_VER: 'config:ver',
  CONFIG_GESTIONAR: 'config:gestionar',

  USUARIO_GESTIONAR: 'usuario:gestionar',
  AUDITORIA_VER: 'auditoria:ver',
} as const;
export type Permiso = (typeof Permiso)[keyof typeof Permiso];

const TODOS: readonly Permiso[] = Object.values(Permiso);

export const PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]> = {
  ADMIN: TODOS,

  SECRETARIA: [
    Permiso.PROYECTO_VER,
    Permiso.LOTE_VER,
    Permiso.CLIENTE_VER,
    Permiso.CLIENTE_GESTIONAR,
    Permiso.VENTA_VER,
    Permiso.VENTA_CREAR,
    Permiso.PAGO_VER,
    Permiso.PAGO_CREAR,
    Permiso.CONTRATO_VER,
    Permiso.CONTRATO_GENERAR,
    Permiso.REPORTE_VER,
    Permiso.REPORTE_EXPORTAR,
  ],

  // Solo consulta. No ve movimientos de dinero.
  EMPLEADO: [
    Permiso.PROYECTO_VER,
    Permiso.LOTE_VER,
    Permiso.CLIENTE_VER,
    Permiso.VENTA_VER,
    Permiso.REPORTE_VER,
  ],
};

export function tienePermiso(rol: Rol, permiso: Permiso): boolean {
  return PERMISOS_POR_ROL[rol].includes(permiso);
}

export function tieneAlgunPermiso(rol: Rol, permisos: readonly Permiso[]): boolean {
  return permisos.some((p) => tienePermiso(rol, p));
}

export function tieneTodosLosPermisos(rol: Rol, permisos: readonly Permiso[]): boolean {
  return permisos.every((p) => tienePermiso(rol, p));
}

/** Modulos visibles en el menu lateral, segun el rol. */
export const PERMISO_POR_MODULO: Record<string, Permiso> = {
  dashboard: Permiso.PROYECTO_VER,
  proyectos: Permiso.PROYECTO_VER,
  clientes: Permiso.CLIENTE_VER,
  lotes: Permiso.LOTE_VER,
  ventas: Permiso.VENTA_VER,
  pagos: Permiso.PAGO_VER,
  contratos: Permiso.CONTRATO_VER,
  reportes: Permiso.REPORTE_VER,
  configuracion: Permiso.CONFIG_VER,
};

export function modulosVisibles(rol: Rol): string[] {
  return Object.entries(PERMISO_POR_MODULO)
    .filter(([, permiso]) => tienePermiso(rol, permiso))
    .map(([modulo]) => modulo);
}
