import { describe, expect, it } from 'vitest';
import { Permiso, modulosVisibles, tienePermiso } from './permisos.js';

describe('matriz de permisos', () => {
  it('el administrador puede todo', () => {
    for (const p of Object.values(Permiso)) {
      expect(tienePermiso('ADMIN', p)).toBe(true);
    }
  });

  it('la secretaria registra ventas y pagos pero no anula', () => {
    expect(tienePermiso('SECRETARIA', Permiso.VENTA_CREAR)).toBe(true);
    expect(tienePermiso('SECRETARIA', Permiso.PAGO_CREAR)).toBe(true);
    expect(tienePermiso('SECRETARIA', Permiso.VENTA_ANULAR)).toBe(false);
    expect(tienePermiso('SECRETARIA', Permiso.PAGO_ANULAR)).toBe(false);
  });

  it('la secretaria no gestiona lotes ni configuracion', () => {
    expect(tienePermiso('SECRETARIA', Permiso.LOTE_GESTIONAR)).toBe(false);
    expect(tienePermiso('SECRETARIA', Permiso.CONFIG_GESTIONAR)).toBe(false);
    expect(tienePermiso('SECRETARIA', Permiso.USUARIO_GESTIONAR)).toBe(false);
  });

  it('el empleado solo consulta y no ve dinero', () => {
    expect(tienePermiso('EMPLEADO', Permiso.LOTE_VER)).toBe(true);
    expect(tienePermiso('EMPLEADO', Permiso.VENTA_VER)).toBe(true);
    expect(tienePermiso('EMPLEADO', Permiso.PAGO_VER)).toBe(false);
    expect(tienePermiso('EMPLEADO', Permiso.VENTA_CREAR)).toBe(false);
  });

  it('el menu lateral se deriva del rol', () => {
    expect(modulosVisibles('ADMIN')).toHaveLength(10);
    expect(modulosVisibles('SECRETARIA')).not.toContain('configuracion');
    expect(modulosVisibles('EMPLEADO')).not.toContain('pagos');
    expect(modulosVisibles('EMPLEADO')).toContain('lotes');
    // La auditoria es solo del administrador.
    expect(modulosVisibles('SECRETARIA')).not.toContain('auditoria');
    expect(modulosVisibles('ADMIN')).toContain('auditoria');
  });
});
