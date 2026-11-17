import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io } from 'socket.io-client';
import { AddressInfo } from 'net';
import { PrismaService } from '../src/prisma/prisma.service';
import { startFakeTraccar } from './fake-traccar';

/** Flujo completo: registro -> Traccar -> posición por WebSocket -> cliente de la empresa correcta. */
describe('Integración con Traccar (servidor simulado de pruebas)', () => {
  let fake: Awaited<ReturnType<typeof startFakeTraccar>>;
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    fake = await startFakeTraccar();
    process.env.TRACCAR_URL = fake.url;
    process.env.TRACCAR_ADMIN_EMAIL = 'admin';
    process.env.TRACCAR_ADMIN_PASSWORD = 'secret';
    process.env.TRACCAR_PUBLIC_HOST = 'gps.ejemplo.mx';
    const { createApp, resetDb } = await import('./helpers');
    ({ app, prisma } = await createApp());
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
    await fake.close();
  });

  it('registra el equipo en Traccar, recibe su primera posición y la entrega solo a su empresa', async () => {
    const { makeUser, login } = await import('./helpers');
    const c = await prisma.company.create({ data: { name: 'Fletes Norte' } });
    const other = await prisma.company.create({ data: { name: 'Otra' } });
    await makeUser(prisma, 'inst@test.mx', 'COMPANY_ADMIN', c.id);
    await makeUser(prisma, 'otra@test.mx', 'COMPANY_ADMIN', other.id);
    const token = await login(app, 'inst@test.mx');
    const otherToken = await login(app, 'otra@test.mx');
    const auth = { Authorization: `Bearer ${token}` };

    const created = await request(app.getHttpServer())
      .post('/api/devices')
      .set(auth)
      .send({ name: 'Teléfono de prueba', manufacturer: 'Traccar Client', model: 'App para teléfono (Android/iOS)', protocol: 'osmand', port: 5055, uniqueId: '987654' })
      .expect(201);
    expect(created.body.traccarDeviceId).toBeGreaterThan(0);
    expect(created.body.status).toBe('WAITING');
    expect(fake.groups).toHaveLength(1);
    const traccarId = created.body.traccarDeviceId;

    const sheet = await request(app.getHttpServer()).get(`/api/devices/${created.body.id}/setup`).set(auth).expect(200);
    expect(sheet.body.server).toMatchObject({ host: 'gps.ejemplo.mx', port: 5055, transport: 'HTTP' });
    expect(sheet.body.instructions.verification).toBe('official');

    // esperar a que el backend abra el WebSocket con Traccar
    for (let i = 0; i < 50 && fake.connected() === 0; i++) await new Promise((r) => setTimeout(r, 100));
    expect(fake.connected()).toBe(1);

    await app.listen(0);
    const port = (app.getHttpServer().address() as AddressInfo).port;
    const mine = io(`http://127.0.0.1:${port}`, { path: '/api/socket.io', auth: { token }, transports: ['websocket'] });
    const theirs = io(`http://127.0.0.1:${port}`, { path: '/api/socket.io', auth: { token: otherToken }, transports: ['websocket'] });
    await Promise.all([new Promise((r) => mine.on('ready', r)), new Promise((r) => theirs.on('ready', r))]);
    let leaked = false;
    theirs.on('positions', () => (leaked = true));
    const got = new Promise<any[]>((r) => mine.on('positions', r));

    const now = new Date().toISOString();
    const dev = fake.devices.find((d) => d.id === traccarId);
    Object.assign(dev, { status: 'online', lastUpdate: now, positionId: 10 });
    fake.push({ devices: [dev] });
    fake.push({
      positions: [
        { id: 10, deviceId: traccarId, protocol: 'osmand', serverTime: now, deviceTime: now, fixTime: now, outdated: false, valid: true, latitude: 19.4326, longitude: -99.1332, altitude: 2240, speed: 10, course: 90, address: null, accuracy: 5, attributes: { ignition: true } },
        { id: 11, deviceId: 999, protocol: 'osmand', serverTime: now, deviceTime: now, fixTime: now, outdated: false, valid: true, latitude: 0, longitude: 0, altitude: 0, speed: 0, course: 0, address: null, accuracy: 0, attributes: {} },
      ],
    });
    const positions = await got;
    expect(positions).toHaveLength(1); // el dispositivo 999 no registrado se descarta
    expect(positions[0]).toMatchObject({ deviceId: created.body.id, latitude: 19.4326, source: 'traccar', ignition: true });
    expect(positions[0].speedKmh).toBeCloseTo(18.5, 1); // 10 nudos
    await new Promise((r) => setTimeout(r, 200));
    expect(leaked).toBe(false);

    const diag = await request(app.getHttpServer()).get(`/api/devices/${created.body.id}/diagnostics`).set(auth).expect(200);
    expect(diag.body.status).toBe('CONNECTED');
    mine.close();
    theirs.close();
  });
});
