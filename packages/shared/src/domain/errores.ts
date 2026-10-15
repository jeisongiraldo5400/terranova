/* ==========================================================================
   Errores de dominio
   --------------------------------------------------------------------------
   El dominio no conoce HTTP. Lanza estos errores y la capa de Nest los
   traduce a codigos de estado en un ExceptionFilter. Asi la misma regla
   corre igual en la API, en los tests y en el script de migracion.
   ========================================================================== */

export type CodigoError =
  | 'REGLA_NEGOCIO'
  | 'TRANSICION_INVALIDA'
  | 'NO_ENCONTRADO'
  | 'CONFLICTO'
  | 'SIN_PERMISO';

export class ErrorDominio extends Error {
  constructor(
    message: string,
    readonly codigo: CodigoError = 'REGLA_NEGOCIO',
    readonly detalles?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Una regla de negocio se incumplio. El mensaje es apto para mostrar al usuario. */
export class ErrorReglaNegocio extends ErrorDominio {
  constructor(message: string, detalles?: Record<string, unknown>) {
    super(message, 'REGLA_NEGOCIO', detalles);
  }
}

/** Se intento una transicion de estado que la maquina de estados no permite. */
export class ErrorTransicion extends ErrorDominio {
  constructor(message: string, detalles?: Record<string, unknown>) {
    super(message, 'TRANSICION_INVALIDA', detalles);
  }
}

export class ErrorNoEncontrado extends ErrorDominio {
  constructor(entidad: string, id?: string) {
    super(id ? `${entidad} no encontrado (${id})` : `${entidad} no encontrado`, 'NO_ENCONTRADO');
  }
}

export class ErrorConflicto extends ErrorDominio {
  constructor(message: string, detalles?: Record<string, unknown>) {
    super(message, 'CONFLICTO', detalles);
  }
}

export class ErrorSinPermiso extends ErrorDominio {
  constructor(message = 'No tiene permiso para realizar esta accion') {
    super(message, 'SIN_PERMISO');
  }
}
