import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Company, Device, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TraccarClient, TraccarError } from '../traccar/traccar.client';
import { TraccarSocket } from '../traccar/traccar.socket';
import { DeviceRegistry } from '../traccar/device-registry';
import { DemoService } from '../demo/demo.service';
import { env } from '../config/env';
import { AuthUser } from '../common/auth-user';
import { assertWritable, resolveCompanyId, tenantWhere } from '../common/tenant';
import { CatalogService } from './catalog.service';
import { CreateDeviceDto, UpdateDeviceDto } from './dto';
import { deriveDeviceStatus, STATUS_LABELS } from './device-status';
import { instructionsFor } from './setup-sheet';
import { LivePosition, normalizePosition } from '../traccar/traccar.types';

const include = { vehicle: { select: { id: true, economicNumber: true, plates: true } }, simCard: true } as const;

@Injectable()
export class DevicesService {
  private log = new Logger('Devices');
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private traccar: TraccarClient,
    private socket: TraccarSocket,
    private registry: DeviceRegistry,
    private catalog: CatalogService,
    private demo: DemoService,
  ) {}

  list(user: AuthUser, companyId?: string) {
    return this.prisma.device.findMany({ where: tenantWhere(user, companyId), include, orderBy: { name: 'asc' } });
  }

  async findOwned(user: AuthUser, id: string) {
    const d = await this.prisma.device.findFirst({ where: { id, ...tenantWhere(user) }, include: { ...include, company: true } });
    if (!d) throw new NotFoundException('Dispositivo no encontrado');
    return d;
  }

  private async ensureGroup(company: Company): Promise<number | undefined> {
    if (company.traccarGroupId) return company.traccarGroupId;
    const g = await this.traccar.createGroup(`FS · ${company.name} · ${company.id.slice(0, 8)}`);
    await this.prisma.company.update({ where: { id: company.id }, data: { traccarGroupId: g.id } });
    return g.id;
  }

  async create(user: AuthUser, dto: CreateDeviceDto) {
    assertWritable(user);
    const companyId = resolveCompanyId(user, dto.companyId);
    if (!this.catalog.isValid(dto.protocol, dto.port)) {
      throw new BadRequestException('El protocolo y puerto no corresponden a ningún equipo del catálogo oficial de Traccar');
    }
    if (dto.vehicleId) {
      const v = await this.prisma.vehicle.findFirst({ where: { id: dto.vehicleId, companyId }, include: { device: true } });
      if (!v) throw new BadRequestException('La unidad no pertenece a la empresa');
      if (v.device) throw new ConflictException(`La unidad ${v.economicNumber} ya tiene un GPS asignado`);
    }
    if (await this.prisma.device.findUnique({ where: { uniqueId: dto.uniqueId } })) {
      throw new ConflictException('Ya existe un dispositivo registrado con ese identificador (IMEI)');
    }
    const device = await this.prisma.$transaction(async (tx) => {
      let simCardId: string | undefined;
      if (dto.sim) {
        const existing = await tx.simCard.findUnique({ where: { iccid: dto.sim.iccid }, include: { device: true } });
        if (existing && (existing.companyId !== companyId || existing.device)) throw new ConflictException('La SIM ya está registrada en otro dispositivo');
        const sim = existing ?? (await tx.simCard.create({ data: { ...dto.sim, companyId } }));
        simCardId = sim.id;
      }
      return tx.device.create({
        data: {
          companyId,
          name: dto.name,
          manufacturer: dto.manufacturer,
          model: dto.model,
          protocol: dto.protocol,
          port: dto.port,
          uniqueId: dto.uniqueId,
          serialNumber: dto.serialNumber,
          vehicleId: dto.vehicleId,
          simCardId,
        },
      });
    });
    await this.audit.record({ companyId, userId: user.id, action: 'device.create', entity: 'Device', entityId: device.id, metadata: { uniqueId: dto.uniqueId, protocol: dto.protocol } });
    const synced = await this.syncToTraccar(device);
    return { ...synced, traccarEnabled: this.traccar.enabled };
  }

  /** Registra el dispositivo en Traccar dentro del grupo de su empresa. */
  async syncToTraccar(device: Device) {
    if (!this.traccar.enabled || device.traccarDeviceId) return device;
    try {
      const company = await this.prisma.company.findUniqueOrThrow({ where: { id: device.companyId } });
      const groupId = await this.ensureGroup(company);
      const td = await this.traccar.createDevice({ name: device.name, uniqueId: device.uniqueId, groupId, model: device.model });
      const updated = await this.prisma.device.update({ where: { id: device.id }, data: { traccarDeviceId: td.id, status: 'WAITING' } });
      await this.registry.reload();
      return updated;
    } catch (e) {
      const msg = e instanceof TraccarError ? e.body : (e as Error).message;
      this.log.warn(`No se pudo registrar ${device.uniqueId} en Traccar: ${msg}`);
      return this.prisma.device.update({ where: { id: device.id }, data: { status: 'CONFIG_ERROR' } });
    }
  }

  async retrySync(user: AuthUser, id: string) {
    assertWritable(user);
    const d = await this.findOwned(user, id);
    if (!this.traccar.enabled) throw new BadRequestException('El servidor Traccar no está configurado');
    return this.syncToTraccar(d);
  }

  async update(user: AuthUser, id: string, dto: UpdateDeviceDto) {
    assertWritable(user);
    const d = await this.findOwned(user, id);
    if (dto.vehicleId) {
      const v = await this.prisma.vehicle.findFirst({ where: { id: dto.vehicleId, companyId: d.companyId }, include: { device: true } });
      if (!v) throw new BadRequestException('La unidad no pertenece a la empresa');
      if (v.device && v.device.id !== id) throw new ConflictException(`La unidad ${v.economicNumber} ya tiene un GPS asignado`);
    }
    const updated = await this.prisma.device.update({ where: { id }, data: dto, include });
    if (dto.name && d.traccarDeviceId && this.traccar.enabled) {
      const td = await this.traccar.device(d.traccarDeviceId).catch(() => null);
      if (td) await this.traccar.updateDevice({ ...td, name: dto.name }).catch(() => undefined);
    }
    await this.registry.reload();
    await this.audit.record({ companyId: d.companyId, userId: user.id, action: 'device.update', entity: 'Device', entityId: id, metadata: { ...dto } });
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    assertWritable(user);
    const d = await this.findOwned(user, id);
    if (d.traccarDeviceId && this.traccar.enabled) {
      await this.traccar.deleteDevice(d.traccarDeviceId).catch((e) => this.log.warn(`Traccar: ${(e as Error).message}`));
    }
    await this.prisma.device.delete({ where: { id } });
    await this.registry.reload();
    await this.audit.record({ companyId: d.companyId, userId: user.id, action: 'device.delete', entity: 'Device', entityId: id, metadata: { uniqueId: d.uniqueId } });
  }

  livePosition(d: Pick<Device, 'id' | 'isDemo' | 'traccarDeviceId'>): LivePosition | null {
    if (d.isDemo) return this.demo.latest.get(d.id) ?? null;
    if (d.traccarDeviceId) return this.socket.latest.get(d.traccarDeviceId) ?? null;
    return null;
  }

  async diagnostics(user: AuthUser, id: string) {
    const d = await this.findOwned(user, id);
    const offlineMinutes = env().DEVICE_OFFLINE_MINUTES;
    if (d.isDemo) {
      const pos = this.demo.latest.get(d.id) ?? null;
      return { status: d.status, statusLabel: STATUS_LABELS[d.status], demo: true, lastPosition: pos, traccar: null };
    }
    let td = d.traccarDeviceId ? this.socket.deviceStatus.get(d.traccarDeviceId) : undefined;
    let pos = this.livePosition(d);
    let traccarReachable = this.traccar.enabled;
    if (this.traccar.enabled && d.traccarDeviceId) {
      try {
        td = (await this.traccar.device(d.traccarDeviceId)) ?? undefined;
        if (td && !pos && td.positionId) {
          const positions = await this.traccar.request<Parameters<typeof normalizePosition>[0][]>('GET', `/api/positions?id=${td.positionId}`);
          if (positions[0]) pos = normalizePosition(positions[0], d.id, d.vehicleId);
        }
      } catch {
        traccarReachable = false;
      }
    }
    let status = d.status;
    if (traccarReachable || !this.traccar.enabled) {
      status = deriveDeviceStatus({ traccarDeviceId: d.traccarDeviceId, traccarDevice: td ?? null, lastPosition: pos, offlineMinutes });
      if (status !== d.status) await this.prisma.device.update({ where: { id }, data: { status } });
    }
    return {
      status,
      statusLabel: STATUS_LABELS[status],
      demo: false,
      traccarEnabled: this.traccar.enabled,
      traccarReachable,
      traccar: td ? { status: td.status, lastUpdate: td.lastUpdate } : null,
      lastPosition: pos,
    };
  }

  async setupSheet(user: AuthUser, id: string) {
    const d = await this.findOwned(user, id);
    const host = env().TRACCAR_PUBLIC_HOST;
    return {
      device: { name: d.name, manufacturer: d.manufacturer, model: d.model, uniqueId: d.uniqueId },
      server: { host: host || null, hostConfigured: Boolean(host), port: d.port, transport: d.protocol === 'osmand' ? 'HTTP' : 'TCP', protocol: d.protocol },
      apn: d.simCard?.apn ?? null,
      interval: { movingSeconds: 30, stoppedSeconds: 300 },
      instructions: instructionsFor(d.manufacturer, d.protocol, host, d.port, d.uniqueId, d.simCard?.apn ?? null),
    };
  }

  async route(user: AuthUser, id: string, from: Date, to: Date) {
    const d = await this.findOwned(user, id);
    if (to <= from) throw new BadRequestException('Rango de fechas inválido');
    if (to.getTime() - from.getTime() > 7 * 86_400_000) throw new BadRequestException('El rango máximo es de 7 días');
    if (d.isDemo) return { demo: true, positions: this.demo.history(d.id, from, to) };
    if (!d.traccarDeviceId) return { demo: false, positions: [] };
    const positions = await this.traccar.route(d.traccarDeviceId, from, to);
    return { demo: false, positions: positions.map((p) => normalizePosition(p, d.id, d.vehicleId)) };
  }
}

export type { Prisma };
