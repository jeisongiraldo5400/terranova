import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Permiso, actualizarClienteSchema, crearClienteSchema, filtroClientesSchema,
} from '@terranova/shared';
import { zodPipe } from '../../common/zod/zod-validation.pipe.js';
import { Actual, Requiere } from '../../common/auth/decoradores.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';
import { ClientesService } from './clientes.service.js';

@ApiTags('Clientes')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  @Requiere(Permiso.CLIENTE_VER)
  @ApiOperation({ summary: 'Lista clientes; busca sin acentos ni mayusculas' })
  listar(@Query(zodPipe(filtroClientesSchema)) filtro: never) {
    return this.clientes.listar(filtro);
  }

  @Get(':id')
  @Requiere(Permiso.CLIENTE_VER)
  @ApiOperation({ summary: 'Ficha con la cartera consolidada de todos los proyectos' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientes.obtener(id);
  }

  @Post()
  @Requiere(Permiso.CLIENTE_GESTIONAR)
  crear(@Body(zodPipe(crearClienteSchema)) datos: never, @Actual() usuario: UsuarioActual) {
    return this.clientes.crear(datos, usuario);
  }

  @Patch(':id')
  @Requiere(Permiso.CLIENTE_GESTIONAR)
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(actualizarClienteSchema)) datos: never,
    @Actual() usuario: UsuarioActual,
  ) {
    return this.clientes.actualizar(id, datos, usuario);
  }

  @Post(':id/desactivar')
  @Requiere(Permiso.CLIENTE_GESTIONAR)
  desactivar(@Param('id', ParseUUIDPipe) id: string, @Actual() usuario: UsuarioActual) {
    return this.clientes.desactivar(id, usuario);
  }

  @Post(':id/reactivar')
  @Requiere(Permiso.CLIENTE_GESTIONAR)
  reactivar(@Param('id', ParseUUIDPipe) id: string, @Actual() usuario: UsuarioActual) {
    return this.clientes.reactivar(id, usuario);
  }

  @Delete(':id')
  @Requiere(Permiso.CLIENTE_GESTIONAR)
  @HttpCode(204)
  eliminar(@Param('id', ParseUUIDPipe) id: string, @Actual() usuario: UsuarioActual) {
    return this.clientes.eliminar(id, usuario);
  }
}
