import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const getCorsOrigins = () => {
  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    return ['http://localhost:8100', 'http://localhost:4200'];
  }

  return frontendUrl.split(',').map((origin) => origin.trim());
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: getCorsOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
