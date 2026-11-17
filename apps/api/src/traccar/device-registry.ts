import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DeviceRef {
  deviceId: string;
  companyId: string;
  vehicleId: string | null;
}

/**
 * Mapa traccarDeviceId -> dispositivo/empresa. Es la base del aislamiento multiempresa en
 * tiempo real: una posición de Traccar solo se envía a la sala de la empresa propietaria.
 */
@Injectable()
export class DeviceRegistry implements OnModuleInit {
  private log = new Logger('DeviceRegistry');
  private byTraccarId = new Map<number, DeviceRef>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.reload();
    setInterval(() => this.reload().catch((e) => this.log.warn(e.message)), 60_000).unref();
  }

  async reload() {
    const devices = await this.prisma.device.findMany({
      where: { traccarDeviceId: { not: null } },
      select: { id: true, companyId: true, vehicleId: true, traccarDeviceId: true },
    });
    const next = new Map<number, DeviceRef>();
    for (const d of devices) next.set(d.traccarDeviceId!, { deviceId: d.id, companyId: d.companyId, vehicleId: d.vehicleId });
    this.byTraccarId = next;
  }

  get(traccarId: number) {
    return this.byTraccarId.get(traccarId);
  }
}
