import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permiso, generarContratoSchema } from '@terranova/shared';
import { zodPipe } from '../../common/zod/zod-validation.pipe.js';
import { Actual, Requiere } from '../../common/auth/decoradores.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';
import { ContratosService } from './contratos.service.js';

@ApiTags('Contratos')
@Controller('contratos')
export class ContratosController {
  constructor(private readonly contratos: ContratosService) {}

  @Get()
  @Requiere(Permiso.CONTRATO_VER)
  listar(@Query('ventaId') ventaId?: string, @Query('proyectoId') proyectoId?: string) {
    return this.contratos.listar({ ventaId, proyectoId });
  }

  @Post()
  @Requiere(Permiso.CONTRATO_GENERAR)
  @ApiOperation({ summary: 'Genera el contrato PDF, lo numera y lo archiva con su hash' })
  generar(
    @Body(zodPipe(generarContratoSchema)) datos: { ventaId: string; regenerar: boolean },
    @Actual() usuario: UsuarioActual,
  ) {
    return this.contratos.generar(datos.ventaId, datos.regenerar, usuario);
  }

  @Get(':id/pdf')
  @Requiere(Permiso.CONTRATO_VER)
  @ApiOperation({ summary: 'Descarga el PDF verificando su integridad sha256' })
  async descargar(
    @Param('id', ParseUUIDPipe) id: string,
    // Sin passthrough: se escribe la respuesta directamente para que los
    // bytes del PDF no pasen por el serializador JSON de Nest.
    @Res() res: Response,
  ): Promise<void> {
    const { nombre, pdf } = await this.contratos.descargar(id);
    res
      .status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombre}"`,
        'Content-Length': String(pdf.byteLength),
      })
      .end(pdf);
  }
}
