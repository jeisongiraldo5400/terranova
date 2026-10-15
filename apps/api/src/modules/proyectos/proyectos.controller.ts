import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Permiso, actualizarProyectoSchema, crearEtapaSchema, crearProyectoSchema,
} from '@terranova/shared';
import { zodPipe } from '../../common/zod/zod-validation.pipe.js';
import { Actual, Requiere } from '../../common/auth/decoradores.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';
import { ProyectosService } from './proyectos.service.js';

@ApiTags('Proyectos')
@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectos: ProyectosService) {}

  @Get()
  @Requiere(Permiso.PROYECTO_VER)
  @ApiOperation({ summary: 'Lista proyectos con su resumen de inventario y cartera' })
  listar() {
    return this.proyectos.listar();
  }

  @Get(':id')
  @Requiere(Permiso.PROYECTO_VER)
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.proyectos.obtener(id);
  }

  @Post()
  @Requiere(Permiso.PROYECTO_GESTIONAR)
  crear(@Body(zodPipe(crearProyectoSchema)) datos: never, @Actual() usuario: UsuarioActual) {
    return this.proyectos.crear(datos, usuario);
  }

  @Patch(':id')
  @Requiere(Permiso.PROYECTO_GESTIONAR)
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(actualizarProyectoSchema)) datos: never,
    @Actual() usuario: UsuarioActual,
  ) {
    return this.proyectos.actualizar(id, datos, usuario);
  }

  @Post('etapas')
  @Requiere(Permiso.PROYECTO_GESTIONAR)
  crearEtapa(@Body(zodPipe(crearEtapaSchema)) datos: never) {
    return this.proyectos.crearEtapa(datos);
  }

  @Delete(':id')
  @Requiere(Permiso.PROYECTO_GESTIONAR)
  @HttpCode(204)
  eliminar(@Param('id', ParseUUIDPipe) id: string, @Actual() usuario: UsuarioActual) {
    return this.proyectos.eliminar(id, usuario);
  }
}
