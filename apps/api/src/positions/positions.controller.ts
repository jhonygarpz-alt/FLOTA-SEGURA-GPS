import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { TraccarSocket } from '../traccar/traccar.socket';
import { TraccarClient } from '../traccar/traccar.client';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { tenantWhere } from '../common/tenant';
import { env } from '../config/env';

@Controller('monitoring')
export class PositionsController {
  constructor(private prisma: PrismaService, private devices: DevicesService, private socket: TraccarSocket, private traccar: TraccarClient) {}

  /** Flota con su última posición conocida. Sin posición -> null (nunca se inventa). */
  @Get('fleet')
  @RequirePermissions('monitoring:read')
  async fleet(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: tenantWhere(user, companyId),
      include: { operator: { select: { id: true, name: true, phone: true } }, device: true, company: { select: { id: true, name: true, isDemo: true } } },
      orderBy: { economicNumber: 'asc' },
    });
    return {
      offlineMinutes: env().DEVICE_OFFLINE_MINUTES,
      vehicles: vehicles.map((v) => ({
        id: v.id,
        economicNumber: v.economicNumber,
        plates: v.plates,
        type: v.type,
        brand: v.brand,
        model: v.model,
        year: v.year,
        photoUrl: v.photoUrl,
        status: v.status,
        company: v.company,
        operator: v.operator,
        device: v.device ? { id: v.device.id, name: v.device.name, status: v.device.status, isDemo: v.device.isDemo, protocol: v.device.protocol } : null,
        position: v.device ? this.devices.livePosition(v.device) : null,
      })),
    };
  }

  @Get('link')
  @RequirePermissions('monitoring:read')
  link() {
    return { traccarEnabled: this.traccar.enabled, state: this.socket.state, lastMessageAt: this.socket.lastMessageAt };
  }
}
