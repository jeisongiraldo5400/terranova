import { Injectable } from '@nestjs/common';
import type { ConfiguracionEmpresaInput } from '@terranova/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditoriaService } from '../../common/auditoria/auditoria.service.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';

@Injectable()
export class ConfiguracionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Fila unica (id = 1). Alimenta el encabezado de los contratos. */
  obtener() {
    return this.prisma.configuracionEmpresa.findUnique({ where: { id: 1 } });
  }

  async guardar(datos: ConfiguracionEmpresaInput, usuario: UsuarioActual) {
    const antes = await this.obtener();

    const config = await this.prisma.configuracionEmpresa.upsert({
      where: { id: 1 },
      create: { id: 1, ...datos, clausulasContrato: datos.clausulasContrato ?? null },
      update: { ...datos, clausulasContrato: datos.clausulasContrato ?? null },
    });

    await this.auditoria.registrar({
      usuario,
      accion: antes ? 'CONFIGURACION_ACTUALIZADA' : 'CONFIGURACION_CREADA',
      entidad: 'ConfiguracionEmpresa',
      entidadId: '1',
      antes: antes ?? undefined,
      despues: datos,
    });

    return config;
  }
}
