import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppService } from './app.service';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Aumenta o limite do body parser para aceitar base64 de imagens (~10MB)
  app.useBodyParser('json', { limit: '10mb' });

  // CORS configurado com origens seguras
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8081',
      'exp://127.0.0.1:8081',
      'exp://192.168.0.0/16:8081',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-restaurant-id',
      'x-tenant-id',
      'x-user-id',
      'x-user-role',
    ],
  });

  // Security headers
  app.use(helmet());

  app.use(cookieParser());

  // Configura Socket.io adapter para WebSocket
  app.useWebSocketAdapter(new IoAdapter(app));

  // Habilita validação global (opcional, mas recomendado)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Almocu API Gateway')
    .setDescription('Documentação unificada das APIs do ecossistema Almocu')
    .setVersion('1.0')
    .addBearerAuth() // Adiciona suporte a Bearer Token no Swagger
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Salva o documento base no AppService para a fusão dinâmica
  const appService = app.get(AppService);
  appService.setBaseSwaggerDocument(document);

  SwaggerModule.setup('api', app, document, {
    explorer: true,
    swaggerOptions: {
      urls: [
        { url: '/api/unified-json', name: '✨ Unified (All Services)' },
        { url: '/api-json', name: '1. Auth / Gateway' },
        { url: '/api/stock/api-json', name: '2. Stock Service' },
        { url: '/api/menu/api-json', name: '3. Menu Service' },
        { url: '/api/order/api-json', name: '4. Order Service' },
      ],
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
