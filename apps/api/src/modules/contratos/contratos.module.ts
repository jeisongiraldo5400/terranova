import { Module } from '@nestjs/common';
import { ContratosController } from './contratos.controller.js';
import { ContratosService } from './contratos.service.js';

@Module({ controllers: [ContratosController], providers: [ContratosService] })
export class ContratosModule {}
