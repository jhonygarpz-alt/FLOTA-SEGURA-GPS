import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function resetDb(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "AuditLog","RefreshSession","Device","SimCard","Vehicle","Operator","User","Subscription","Plan","Company" CASCADE',
  );
}

export const PASSWORD = 'Contrasena-Segura-123';
let hash: string | null = null;

export async function makeUser(prisma: PrismaService, email: string, role: Role, companyId: string | null) {
  hash ??= await argon2.hash(PASSWORD);
  return prisma.user.create({ data: { email, name: email, role, companyId, passwordHash: hash } });
}

export async function login(app: INestApplication, email: string): Promise<string> {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return res.body.accessToken;
}
