import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permiso, anularPagoSchema, filtroPagosSchema, registrarPagoSchema } from '@terranova/shared';
import { zodPipe } from '../../common/zod/zod-validation.pipe.js';
import { Actual, Requiere } from '../../common/auth/decoradores.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';
import { PagosService } from './pagos.service.js';

@ApiTags('Pagos')
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagos: PagosService) {}

  @Get()
  @Requiere(Permiso.PAGO_VER)
  @ApiOperation({ summary: 'Lista pagos; los anulados se incluyen solo si se piden' })
  listar(@Query(zodPipe(filtroPagosSchema)) filtro: never) {
    return this.pagos.listar(filtro);
  }

  @Get('estado-cuenta/:ventaId')
  @Requiere(Permiso.PAGO_VER)
  @ApiOperation({ summary: 'Estado de cuenta de una venta, con mora' })
  estadoCuenta(@Param('ventaId', ParseUUIDPipe) ventaId: string) {
    return this.pagos.estadoCuenta(ventaId);
  }

  @Post()
  @Requiere(Permiso.PAGO_CREAR)
  @ApiOperation({ summary: 'Registra un abono y recalcula el estado de la venta' })
  registrar(@Body(zodPipe(registrarPagoSchema)) datos: never, @Actual() usuario: UsuarioActual) {
    return this.pagos.registrar(datos, usuario);
  }

  @Post(':id/anular')
  @Requiere(Permiso.PAGO_ANULAR)
  @ApiOperation({ summary: 'Anula un pago sin borrarlo, con motivo obligatorio' })
  anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(anularPagoSchema)) datos: { motivo: string },
    @Actual() usuario: UsuarioActual,
  ) {
    return this.pagos.anular(id, datos.motivo, usuario);
  }
}
