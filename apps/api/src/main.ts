import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { env, traccarConfigured } from './config/env';

async function main() {
  const e = env(); // falla de inmediato si la configuración es inválida
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  configureApp(app);
  app.enableShutdownHooks();
  // '::' acepta IPv6 (red privada de Railway) e IPv4
  await app.listen(e.PORT, '::');
  const log = new Logger('Bootstrap');
  log.log(`FLOTA SEGURA GPS API escuchando en el puerto ${e.PORT}`);
  if (!traccarConfigured()) log.warn('Traccar NO configurado: solo funciona el modo demostración');
}

void main();
