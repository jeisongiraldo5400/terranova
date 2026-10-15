import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function arrancar(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Arranque');

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());

  // Sin ValidationPipe de Nest: la validacion la hace ZodValidationPipe
  // por ruta, con los esquemas de @terranova/shared. Tener las dos capas
  // obligaria a mantener las reglas por duplicado (y a instalar
  // class-validator solo para eso).

  // El frontend manda cookies httpOnly, por lo que el origen debe ser
  // explicito: con credentials no se admite el comodin.
  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGIN').split(','),
    credentials: true,
  });

  if (config.get<string>('NODE_ENV') !== 'production') {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('TERRANOVA API')
        .setDescription('Sistema de administracion de lotes')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, documento);
  }

  app.enableShutdownHooks();

  const puerto = config.get<number>('API_PORT', 3001);
  await app.listen(puerto);

  logger.log(`API escuchando en http://localhost:${puerto}/api`);
  if (config.get<string>('NODE_ENV') !== 'production') {
    logger.log(`Documentacion en http://localhost:${puerto}/api/docs`);
  }
}

arrancar().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('No se pudo arrancar la API:', error);
  process.exit(1);
});
