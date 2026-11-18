import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureHttpSecurity } from './config/http-security.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  const webOrigin =
    config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  configureHttpSecurity(
    app,
    webOrigin,
    config.get<string>('NODE_ENV') === 'production',
  );
  await app.listen(config.getOrThrow<number>('PORT'));
}
await bootstrap();
