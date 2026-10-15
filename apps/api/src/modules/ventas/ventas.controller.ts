import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Permiso,
  anularVentaSchema,
  filtroVentasSchema,
  registrarVentaSchema,
} from '@terranova/shared';
import { zodPipe } from '../../common/zod/zod-validation.pipe.js';
import { Actual, Requiere } from '../../common/auth/decoradores.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';
import { VentasService } from './ventas.service.js';

@ApiTags('Ventas')
@Controller('ventas')
export class VentasController {
  constructor(private readonly ventas: VentasService) {}

  @Get()
  @Requiere(Permiso.VENTA_VER)
  @ApiOperation({ summary: 'Lista ventas con su estado de cuenta' })
  listar(@Query(zodPipe(filtroVentasSchema)) filtro: never) {
    return this.ventas.listar(filtro);
  }

  @Get(':id')
  @Requiere(Permiso.VENTA_VER)
  @ApiOperation({ summary: 'Detalle de una venta con plan, cuotas y pagos' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.ventas.obtener(id);
  }

  @Post()
  @Requiere(Permiso.VENTA_CREAR)
  @ApiOperation({ summary: 'Registra una venta, su plan de pago y bloquea el lote' })
  registrar(
    @Body(zodPipe(registrarVentaSchema)) datos: never,
    @Actual() usuario: UsuarioActual,
  ) {
    return this.ventas.registrar(datos, usuario);
  }

  @Post(':id/anular')
  @Requiere(Permiso.VENTA_ANULAR)
  @ApiOperation({ summary: 'Anula la venta, libera el lote y reversa los pagos' })
  anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(anularVentaSchema)) datos: never,
    @Actual() usuario: UsuarioActual,
  ) {
    return this.ventas.anular(id, datos, usuario);
  }
}
