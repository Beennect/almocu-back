import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Aumenta o limite do body parser para aceitar base64 de imagens (~10MB)
  app.useBodyParser('json', { limit: '10mb' });

  // Cria a pasta de uploads se não existir
  const uploadsDir = join(__dirname, '..', '..', '..', 'uploads', 'products');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
    logger.log(`Pasta de uploads criada: ${uploadsDir}`);
  }

  // Security headers — deve vir ANTES do useStaticAssets para aplicar em arquivos estáticos
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Servir arquivos estáticos (uploads de imagens)
  app.useStaticAssets(join(__dirname, '..', '..', '..', 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  // CORS para desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    app.enableCors({
      origin: ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
    });
  }

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuração do Swagger
  const config = new DocumentBuilder()
    .setTitle('Almoco Menu API')
    .setDescription('The Menu microservice API for Almoco app')
    .setVersion('1.0')
    .addTag('products')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3200;
  await app.listen(port);
  console.log(`Menu microservice is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api`,
  );
}
void bootstrap();
