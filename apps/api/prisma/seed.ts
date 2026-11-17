/**
 * Datos iniciales idempotentes:
 * - Superadministrador de SECUREFLEET CONSULTING (credenciales desde variables de entorno).
 * - Planes comerciales de referencia (precios a definir por SECUREFLEET).
 * - Empresa de DEMOSTRACIÓN con unidades simuladas, separada de los datos reales.
 */
import { PrismaClient, VehicleType } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_SUPERADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 12) throw new Error('SEED_SUPERADMIN_PASSWORD debe tener al menos 12 caracteres');
    const exists = await prisma.user.findUnique({ where: { email } });
    if (!exists) {
      await prisma.user.create({
        data: { email, name: 'Administrador SECUREFLEET', role: 'SUPERADMIN', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) },
      });
      console.log(`Superadministrador creado: ${email}`);
    } else console.log('Superadministrador ya existente (sin cambios)');
  } else {
    console.log('SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD no definidos: se omite el superadministrador');
  }

  const plans = [
    { name: 'Esencial', priceMxn: 0, maxDevices: 10, features: ['monitoring', 'trips', 'alerts'] },
    { name: 'Profesional', priceMxn: 0, maxDevices: 100, features: ['monitoring', 'trips', 'alerts', 'geofences', 'reports', 'logbook'] },
    { name: 'Corporativo', priceMxn: 0, maxDevices: 10000, features: ['all'] },
  ];
  for (const p of plans) await prisma.plan.upsert({ where: { name: p.name }, update: {}, create: p });

  let demo = await prisma.company.findFirst({ where: { isDemo: true } });
  if (!demo) {
    demo = await prisma.company.create({ data: { name: 'Transportes Demostración', legalName: 'Empresa ficticia para demostración', isDemo: true } });
  }
  const demoEmail = 'demo@flotasegura.demo';
  if (!(await prisma.user.findUnique({ where: { email: demoEmail } }))) {
    await prisma.user.create({
      data: {
        email: demoEmail,
        name: 'Invitado demostración',
        role: 'VIEWER',
        companyId: demo.id,
        // Contraseña aleatoria no divulgada: el acceso demo es solo por /api/auth/demo
        passwordHash: await argon2.hash(randomBytes(32).toString('hex')),
      },
    });
  }

  const operators = ['Juan Pérez Ramírez', 'María López Hernández', 'Carlos Sánchez Díaz', 'Ana Torres Medina', 'Luis Gómez Castillo'];
  const opIds: string[] = [];
  for (const name of operators) {
    const op = (await prisma.operator.findFirst({ where: { companyId: demo.id, name } })) ?? (await prisma.operator.create({ data: { companyId: demo.id, name, phone: '5500000000' } }));
    opIds.push(op.id);
  }

  const units: { eco: string; plates: string; type: VehicleType; brand: string; model: string; year: number; op?: number }[] = [
    { eco: 'T-101', plates: 'DEMO-101', type: 'TRACTOR', brand: 'Kenworth', model: 'T680', year: 2022, op: 0 },
    { eco: 'AT-202', plates: 'DEMO-202', type: 'TANKER', brand: 'Freightliner', model: 'Cascadia', year: 2021, op: 1 },
    { eco: 'C-303', plates: 'DEMO-303', type: 'TRUCK', brand: 'International', model: 'MV', year: 2020, op: 2 },
    { eco: 'A-404', plates: 'DEMO-404', type: 'CAR', brand: 'Nissan', model: 'Versa', year: 2023, op: 3 },
    { eco: 'R-505', plates: 'DEMO-505', type: 'TRAILER', brand: 'Utility', model: '3000R', year: 2019 },
    { eco: 'AT-606', plates: 'DEMO-606', type: 'TANKER', brand: 'Kenworth', model: 'T880', year: 2020, op: 4 },
    { eco: 'M-707', plates: 'DEMO-707', type: 'MOTORCYCLE', brand: 'Italika', model: 'FT150', year: 2022 },
  ];
  for (const [i, u] of units.entries()) {
    const vehicle =
      (await prisma.vehicle.findFirst({ where: { companyId: demo.id, economicNumber: u.eco } })) ??
      (await prisma.vehicle.create({
        data: { companyId: demo.id, economicNumber: u.eco, plates: u.plates, type: u.type, brand: u.brand, model: u.model, year: u.year, operatorId: u.op !== undefined ? opIds[u.op] : null },
      }));
    const uniqueId = `DEMO-${String(i + 1).padStart(4, '0')}`;
    if (!(await prisma.device.findUnique({ where: { uniqueId } }))) {
      await prisma.device.create({
        data: { companyId: demo.id, name: `GPS ${u.eco}`, manufacturer: 'Demostración', model: 'Simulador', protocol: 'demo', port: 0, uniqueId, isDemo: true, vehicleId: vehicle.id, status: i === 6 ? 'NO_COMMUNICATION' : 'CONNECTED' },
      });
    }
  }
  console.log('Empresa de demostración lista');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
