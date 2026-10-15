import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from './common/prisma/prisma.module.js';
import { AuditoriaModule } from './common/auditoria/auditoria.module.js';
import { JwtAuthGuard } from './common/auth/jwt.guard.js';
import { DominioExceptionFilter } from './common/filtros/dominio.filter.js';
import { SerializarInterceptor } from './common/interceptores/serializar.interceptor.js';
import { validarEnv } from './config/env.js';

import { AuthModule } from './modules/auth/auth.module.js';
import { ProyectosModule } from './modules/proyectos/proyectos.module.js';
import { LotesModule } from './modules/lotes/lotes.module.js';
import { ClientesModule } from './modules/clientes/clientes.module.js';
import { VentasModule } from './modules/ventas/ventas.module.js';
import { PagosModule } from './modules/pagos/pagos.module.js';
import { ContratosModule } from './modules/contratos/contratos.module.js';
import { ReportesModule } from './modules/reportes/reportes.module.js';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module.js';
import { SaludController } from './salud.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env'],
      validate: validarEnv,
    }),
    JwtModule.register({}),
    PrismaModule,
    AuditoriaModule,

    AuthModule,
    ProyectosModule,
    LotesModule,
    ClientesModule,
    VentasModule,
    PagosModule,
    ContratosModule,
    ReportesModule,
    ConfiguracionModule,
  ],
  controllers: [SaludController],
  providers: [
    // El guard es global: toda ruta exige sesion salvo las marcadas con
    // @Publico(). Lo contrario -- proteger ruta por ruta -- deja huecos.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: DominioExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: SerializarInterceptor },
  ],
})
export class AppModule {}
