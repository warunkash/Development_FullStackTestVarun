import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('OCPPService');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Use WS adapter for WebSocket support
  app.useWebSocketAdapter(new WsAdapter(app));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS for REST endpoints
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Swagger for REST management endpoints
  const config = new DocumentBuilder()
    .setTitle('ECNT OCPP Service')
    .setDescription(
      'OCPP 1.6 / 2.0.1 WebSocket server and charge point management REST API. ' +
      'WebSocket endpoint: ws://host:9000/ocpp/{chargePointId}',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('ocpp', 'OCPP charge point management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3004;
  const wsPort = process.env.WS_PORT || 9000;

  await app.listen(port);

  logger.log(`OCPP HTTP Service running on port ${port}`);
  logger.log(`OCPP WebSocket Server running on port ${wsPort}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  logger.log(`OCPP WS endpoint: ws://localhost:${wsPort}/ocpp/{chargePointId}`);
}

bootstrap();
