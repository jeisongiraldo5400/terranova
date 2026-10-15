import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permiso, filtroReporteSchema } from '@terranova/shared';
import { zodPipe } from '../../common/zod/zod-validation.pipe.js';
import { Requiere } from '../../common/auth/decoradores.js';
import { ReportesService } from './reportes.service.js';

type Filtro = { proyectoId?: string; desde?: Date; hasta?: Date; fechaCorte?: Date };

@ApiTags('Reportes')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('dashboard')
  @Requiere(Permiso.REPORTE_VER)
  @ApiOperation({ summary: 'Inventario, cartera, recaudo, vencimientos y mora' })
  dashboard(@Query('proyectoId') proyectoId?: string) {
    return this.reportes.dashboard(proyectoId);
  }

  @Get('cartera')
  @Requiere(Permiso.REPORTE_VER)
  cartera(@Query(zodPipe(filtroReporteSchema)) filtro: Filtro) {
    return this.reportes.carteraDetallada(filtro);
  }

  @Get('recaudo')
  @Requiere(Permiso.REPORTE_VER)
  recaudo(@Query(zodPipe(filtroReporteSchema)) filtro: Filtro) {
    return this.reportes.recaudo(filtro);
  }

  @Get('inventario')
  @Requiere(Permiso.REPORTE_VER)
  inventario(@Query(zodPipe(filtroReporteSchema)) filtro: Filtro) {
    return this.reportes.inventario(filtro);
  }

  @Get('proyeccion-cobros')
  @Requiere(Permiso.REPORTE_VER)
  @ApiOperation({ summary: 'Cuanto se espera cobrar cada mes a futuro' })
  proyeccion(@Query(zodPipe(filtroReporteSchema)) filtro: Filtro) {
    return this.reportes.proyeccionCobros(filtro);
  }

  @Get('auditoria')
  @Requiere(Permiso.AUDITORIA_VER)
  @ApiOperation({ summary: 'Historial de quien hizo que y cuando' })
  auditoria(
    @Query('entidad') entidad?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('limite') limite = '100',
  ) {
    return this.reportes.auditoria({
      entidad,
      usuarioId,
      limite: Math.min(Number(limite) || 100, 500),
    });
  }

  @Get('exportar/:reporte')
  @Requiere(Permiso.REPORTE_EXPORTAR)
  @ApiOperation({ summary: 'Descarga un reporte en CSV compatible con Excel' })
  async exportar(
    @Query(zodPipe(filtroReporteSchema)) filtro: Filtro,
    @Res({ passthrough: true }) res: Response,
    @Query('reporte') reporte = 'cartera',
  ) {
    const generadores: Record<string, () => Promise<Array<Record<string, unknown>>>> = {
      cartera: () => this.reportes.carteraDetallada(filtro),
      recaudo: () => this.reportes.recaudo(filtro),
      inventario: () => this.reportes.inventario(filtro),
      'proyeccion-cobros': () => this.reportes.proyeccionCobros(filtro),
    };

    const generador = generadores[reporte] ?? generadores.cartera!;
    const csv = this.reportes.aCsv(await generador());
    const nombre = `${reporte}-${new Date().toISOString().slice(0, 10)}.csv`;

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}"`,
    });
    return csv;
  }
}
