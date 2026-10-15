import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { ConfiguracionController } from './configuracion.controller.js';
import { ConfiguracionService } from './configuracion.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService, UsuariosService],
})
export class ConfiguracionModule {}
