import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Publico } from './common/auth/decoradores.js';
import { PrismaService } from './common/prisma/prisma.service.js';

@ApiTags('Salud')
@Controller('salud')
export class SaludController {
  constructor(private readonly prisma: PrismaService) {}

  @Publico()
  @Get()
  async estado() {
    const inicio = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      estado: 'ok',
      baseDatos: 'conectada',
      latenciaMs: Date.now() - inicio,
      hora: new Date().toISOString(),
    };
  }
}
