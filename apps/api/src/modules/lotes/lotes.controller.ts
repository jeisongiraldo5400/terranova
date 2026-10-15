import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Permiso, actualizarLoteSchema, crearLoteSchema, crearLotesEnLoteSchema, filtroLotesSchema,
} from '@terranova/shared';
import { zodPipe } from '../../common/zod/zod-validation.pipe.js';
import { Actual, Requiere } from '../../common/auth/decoradores.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';
import { LotesService } from './lotes.service.js';

@ApiTags('Lotes')
@Controller('lotes')
export class LotesController {
  constructor(private readonly lotes: LotesService) {}

  @Get()
  @Requiere(Permiso.LOTE_VER)
  listar(@Query(zodPipe(filtroLotesSchema)) filtro: never) {
    return this.lotes.listar(filtro);
  }

  @Get('conteo')
  @Requiere(Permiso.LOTE_VER)
  @ApiOperation({ summary: 'Cantidad, area y valor por estado de lote' })
  conteo(@Query('proyectoId') proyectoId?: string) {
    return this.lotes.conteoPorEstado(proyectoId);
  }

  @Post()
  @Requiere(Permiso.LOTE_GESTIONAR)
  @ApiOperation({ summary: 'Crea un lote; valida el area minima del proyecto' })
  crear(@Body(zodPipe(crearLoteSchema)) datos: never, @Actual() usuario: UsuarioActual) {
    return this.lotes.crear(datos, usuario);
  }

  @Post('en-lote')
  @Requiere(Permiso.LOTE_GESTIONAR)
  @ApiOperation({ summary: 'Crea una manzana completa a partir de un rango' })
  crearEnLote(
    @Body(zodPipe(crearLotesEnLoteSchema)) datos: never,
    @Actual() usuario: UsuarioActual,
  ) {
    return this.lotes.crearEnLote(datos, usuario);
  }

  @Patch(':id')
  @Requiere(Permiso.LOTE_GESTIONAR)
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(actualizarLoteSchema)) datos: never,
    @Actual() usuario: UsuarioActual,
  ) {
    return this.lotes.actualizar(id, datos, usuario);
  }

  @Delete(':id')
  @Requiere(Permiso.LOTE_GESTIONAR)
  @HttpCode(204)
  eliminar(@Param('id', ParseUUIDPipe) id: string, @Actual() usuario: UsuarioActual) {
    return this.lotes.eliminar(id, usuario);
  }
}
