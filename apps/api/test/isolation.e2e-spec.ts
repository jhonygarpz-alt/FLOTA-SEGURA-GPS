import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { PrismaService } from '../src/prisma/prisma.service';
import { RealtimeHub } from '../src/realtime/realtime.hub';
import { createApp, login, makeUser, resetDb, PASSWORD } from './helpers';

describe('Seguridad y aislamiento multiempresa (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string, tokenB: string, viewerA: string, superToken: string;
  let companyA: string, companyB: string, vehicleB: string;

  beforeAll(async () => {
    ({ app, prisma } = await createApp());
    await resetDb(prisma);
    companyA = (await prisma.company.create({ data: { name: 'Empresa A' } })).id;
    companyB = (await prisma.company.create({ data: { name: 'Empresa B' } })).id;
    await makeUser(prisma, 'admin-a@test.mx', 'COMPANY_ADMIN', companyA);
    await makeUser(prisma, 'admin-b@test.mx', 'COMPANY_ADMIN', companyB);
    await makeUser(prisma, 'viewer-a@test.mx', 'VIEWER', companyA);
    await makeUser(prisma, 'root@test.mx', 'SUPERADMIN', null);
    tokenA = await login(app, 'admin-a@test.mx');
    tokenB = await login(app, 'admin-b@test.mx');
    viewerA = await login(app, 'viewer-a@test.mx');
    superToken = await login(app, 'root@test.mx');
    vehicleB = (await prisma.vehicle.create({ data: { companyId: companyB, economicNumber: 'B-1' } })).id;
  });

  afterAll(async () => app.close());

  const http = () => request(app.getHttpServer());

  it('rechaza solicitudes sin sesión', async () => {
    await http().get('/api/vehicles').expect(401);
  });

  it('una empresa no ve las unidades de otra', async () => {
    const res = await http().get('/api/vehicles').set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(res.body).toHaveLength(0);
    await http().get(`/api/vehicles/${vehicleB}`).set('Authorization', `Bearer ${tokenA}`).expect(404);
    await http().get(`/api/vehicles?companyId=${companyB}`).set('Authorization', `Bearer ${tokenA}`).expect(200).expect((r) => expect(r.body).toHaveLength(0));
  });

  it('una empresa no puede modificar ni borrar unidades de otra', async () => {
    await http().patch(`/api/vehicles/${vehicleB}`).set('Authorization', `Bearer ${tokenA}`).send({ plates: 'HACK' }).expect(404);
    await http().delete(`/api/vehicles/${vehicleB}`).set('Authorization', `Bearer ${tokenA}`).expect(404);
    const v = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleB } });
    expect(v.plates).toBeNull();
  });

  it('ignora companyId inyectado al crear: la unidad queda en la empresa del usuario', async () => {
    const res = await http().post('/api/vehicles').set('Authorization', `Bearer ${tokenA}`).send({ economicNumber: 'A-1', companyId: companyB }).expect(201);
    expect(res.body.companyId).toBe(companyA);
  });

  it('el usuario de consulta no puede crear unidades', async () => {
    await http().post('/api/vehicles').set('Authorization', `Bearer ${viewerA}`).send({ economicNumber: 'X' }).expect(403);
  });

  it('solo el superadministrador accede al panel comercial', async () => {
    await http().get('/api/admin/companies').set('Authorization', `Bearer ${tokenA}`).expect(403);
    const res = await http().get('/api/admin/companies').set('Authorization', `Bearer ${superToken}`).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('un administrador de empresa no puede crear superadministradores', async () => {
    await http().post('/api/users').set('Authorization', `Bearer ${tokenA}`).send({ email: 'x@x.mx', name: 'Intruso', password: 'Abcdefghij1', role: 'SUPERADMIN' }).expect(403);
  });

  it('valida los datos de entrada (VIN y campos desconocidos)', async () => {
    await http().post('/api/vehicles').set('Authorization', `Bearer ${tokenA}`).send({ economicNumber: 'A-2', vin: '123' }).expect(400);
    await http().post('/api/vehicles').set('Authorization', `Bearer ${tokenA}`).send({ economicNumber: 'A-3', isAdmin: true }).expect(400);
  });

  it('suspender una empresa bloquea el acceso de sus usuarios', async () => {
    await http().patch(`/api/admin/companies/${companyB}`).set('Authorization', `Bearer ${superToken}`).send({ status: 'SUSPENDED' }).expect(200);
    await http().get('/api/vehicles').set('Authorization', `Bearer ${tokenB}`).expect(403);
    await http().patch(`/api/admin/companies/${companyB}`).set('Authorization', `Bearer ${superToken}`).send({ status: 'ACTIVE' }).expect(200);
  });

  it('el WebSocket solo entrega eventos a la empresa propietaria', async () => {
    await app.listen(0);
    const port = (app.getHttpServer().address() as AddressInfo).port;
    const connect = (token: string) =>
      new Promise<Socket>((resolve, reject) => {
        const s = io(`http://127.0.0.1:${port}`, { path: '/api/socket.io', auth: { token }, transports: ['websocket'] });
        s.on('ready', () => resolve(s));
        s.on('connect_error', reject);
      });
    const sa = await connect(tokenA);
    const sb = await connect(tokenB);
    const received: string[] = [];
    sa.on('positions', () => received.push('A'));
    sb.on('positions', () => received.push('B'));
    app.get(RealtimeHub).toCompany(companyB, 'positions', [{ deviceId: 'x' }]);
    await new Promise((r) => setTimeout(r, 300));
    expect(received).toEqual(['B']);
    // un token inválido es desconectado
    const bad = io(`http://127.0.0.1:${port}`, { path: '/api/socket.io', auth: { token: 'nope' }, transports: ['websocket'] });
    const msg = await new Promise((r) => bad.on('unauthorized', r));
    expect(msg).toBeTruthy();
    sa.close();
    sb.close();
    bad.close();
  });

  it('bloquea la cuenta tras 5 intentos fallidos', async () => {
    for (let i = 0; i < 5; i++) await http().post('/api/auth/login').send({ email: 'viewer-a@test.mx', password: 'incorrecta' }).expect(401);
    await http().post('/api/auth/login').send({ email: 'viewer-a@test.mx', password: PASSWORD }).expect(403);
  });

  it('el refresh token rota y su reutilización revoca la sesión', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email: 'admin-a@test.mx', password: PASSWORD }).expect(200);
    const first = await agent.post('/api/auth/refresh').expect(200);
    const cookie = first.headers['set-cookie'];
    expect(cookie).toBeDefined();
    await agent.post('/api/auth/refresh').expect(200);
    // reutilizar el primer refresh (ya rotado) debe fallar
    const oldCookie = (cookie as unknown as string[])[0].split(';')[0];
    await http().post('/api/auth/refresh').set('Cookie', oldCookie).expect(401);
  });
});
