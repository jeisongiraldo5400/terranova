import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  Permiso, configuracionEmpresaSchema, crearUsuarioSchema, passwordSchema, Rol,
} from '@terranova/shared';
import { zodPipe } from '../../common/zod/zod-validation.pipe.js';
import { Actual, Requiere } from '../../common/auth/decoradores.js';
import type { UsuarioActual } from '../../common/auth/tipos.js';
import { ConfiguracionService } from './configuracion.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';

const cambiarRolSchema = z.object({ rol: z.nativeEnum(Rol) });
const cambiarEstadoSchema = z.object({ activo: z.boolean() });
const restablecerSchema = z.object({ password: passwordSchema });

@ApiTags('Configuracion')
@Controller('configuracion')
export class ConfiguracionController {
  constructor(
    private readonly config: ConfiguracionService,
    private readonly usuarios: UsuariosService,
  ) {}

  @Get('empresa')
  @Requiere(Permiso.CONFIG_VER)
  @ApiOperation({ summary: 'Datos de la empresa usados en los contratos' })
  obtener() {
    return this.config.obtener();
  }

  @Put('empresa')
  @Requiere(Permiso.CONFIG_GESTIONAR)
  guardar(
    @Body(zodPipe(configuracionEmpresaSchema)) datos: never,
    @Actual() usuario: UsuarioActual,
  ) {
    return this.config.guardar(datos, usuario);
  }

  @Get('usuarios')
  @Requiere(Permiso.USUARIO_GESTIONAR)
  listarUsuarios() {
    return this.usuarios.listar();
  }

  @Post('usuarios')
  @Requiere(Permiso.USUARIO_GESTIONAR)
  crearUsuario(
    @Body(zodPipe(crearUsuarioSchema)) datos: never,
    @Actual() usuario: UsuarioActual,
  ) {
    return this.usuarios.crear(datos, usuario);
  }

  @Patch('usuarios/:id/rol')
  @Requiere(Permiso.USUARIO_GESTIONAR)
  cambiarRol(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(cambiarRolSchema)) datos: { rol: never },
    @Actual() usuario: UsuarioActual,
  ) {
    return this.usuarios.cambiarRol(id, datos.rol, usuario);
  }

  @Patch('usuarios/:id/estado')
  @Requiere(Permiso.USUARIO_GESTIONAR)
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(cambiarEstadoSchema)) datos: { activo: boolean },
    @Actual() usuario: UsuarioActual,
  ) {
    return this.usuarios.cambiarEstado(id, datos.activo, usuario);
  }

  @Post('usuarios/:id/restablecer-clave')
  @Requiere(Permiso.USUARIO_GESTIONAR)
  restablecer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(restablecerSchema)) datos: { password: string },
    @Actual() usuario: UsuarioActual,
  ) {
    return this.usuarios.restablecerClave(id, datos.password, usuario);
  }
}
