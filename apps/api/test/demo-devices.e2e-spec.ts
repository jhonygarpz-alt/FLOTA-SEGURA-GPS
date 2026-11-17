import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { execSync } from 'child_process';
import { PrismaService } from '../src/prisma/prisma.service';
import { DemoService } from '../src/demo/demo.service';
import { createApp, login, makeUser, resetDb } from './helpers';

describe('Modo demostración y registro de dispositivos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createApp());
    await resetDb(prisma);
    execSync('npx ts-node prisma/seed.ts', { env: { ...process.env }, stdio: 'ignore' });
    await app.get(DemoService).load();
  });
  afterAll(async () => app.close());
  const http = () => request(app.getHttpServer());

  it('el acceso demo entrega una sesión de solo lectura identificada como demostración', async () => {
    const res = await http().post('/api/auth/demo').expect(200);
    expect(res.body.user.company.isDemo).toBe(true);
    const token = res.body.accessToken;
    const fleet = await http().get('/api/monitoring/fleet').set('Authorization', `Bearer ${token}`).expect(200);
    expect(fleet.body.vehicles).toHaveLength(7);
    const withPos = fleet.body.vehicles.filter((v: any) => v.position);
    expect(withPos.length).toBe(7);
    expect(withPos.every((v: any) => v.position.source === 'demo')).toBe(true);
    await http().post('/api/vehicles').set('Authorization', `Bearer ${token}`).send({ economicNumber: 'Z' }).expect(403);
  });

  it('una empresa real no ve datos de demostración', async () => {
    const c = await prisma.company.create({ data: { name: 'Real SA' } });
    await makeUser(prisma, 'real@test.mx', 'COMPANY_ADMIN', c.id);
    const token = await login(app, 'real@test.mx');
    const fleet = await http().get('/api/monitoring/fleet').set('Authorization', `Bearer ${token}`).expect(200);
    expect(fleet.body.vehicles).toHaveLength(0);
  });

  it('registra un dispositivo validando protocolo/puerto contra el catálogo oficial', async () => {
    const token = await login(app, 'real@test.mx');
    const auth = { Authorization: `Bearer ${token}` };
    await http().post('/api/devices').set(auth).send({ name: 'X', manufacturer: 'Suntech', model: 'ST8300', protocol: 'suntech', port: 9999, uniqueId: '123456789012345' }).expect(400);
    const v = await http().post('/api/vehicles').set(auth).send({ economicNumber: 'U-1', type: 'TRACTOR' }).expect(201);
    const res = await http()
      .post('/api/devices')
      .set(auth)
      .send({ name: 'GPS U-1', manufacturer: 'Suntech', model: 'ST8300', protocol: 'suntech', port: 5011, uniqueId: '123456789012345', vehicleId: v.body.id, sim: { iccid: '8952020000000000001', apn: 'internet.itelcel.com', carrier: 'Telcel' } })
      .expect(201);
    // Sin Traccar configurado queda pendiente; nunca se marca como conectado.
    expect(res.body.status).toBe('PENDING_CONFIG');
    expect(res.body.traccarEnabled).toBe(false);
    const diag = await http().get(`/api/devices/${res.body.id}/diagnostics`).set(auth).expect(200);
    expect(diag.body.status).toBe('PENDING_CONFIG');
    const sheet = await http().get(`/api/devices/${res.body.id}/setup`).set(auth).expect(200);
    expect(sheet.body.server.port).toBe(5011);
    expect(sheet.body.apn).toBe('internet.itelcel.com');
    await http().post('/api/devices').set(auth).send({ name: 'dup', manufacturer: 'Suntech', model: 'ST8300', protocol: 'suntech', port: 5011, uniqueId: '123456789012345' }).expect(409);
  });

  it('expone el catálogo con las notas de modelos prioritarios', async () => {
    const token = await login(app, 'real@test.mx');
    const res = await http().get('/api/devices/catalog/manufacturers').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.manufacturers.map((m: any) => m.name)).toEqual(expect.arrayContaining(['Suntech', 'Teltonika', 'Queclink', 'Concox', 'Jimi IoT', 'Traccar Client']));
    expect(res.body.priority.find((p: any) => p.key === 'at6').verification).toBe('unverified');
  });
});
