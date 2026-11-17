import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import WebSocket from 'ws';
import { PrismaService } from '../prisma/prisma.service';
import { TraccarClient } from './traccar.client';
import { DeviceRegistry } from './device-registry';
import { LivePosition, normalizePosition, TraccarDevice, TraccarEvent, TraccarPosition } from './traccar.types';
import { RealtimeHub } from '../realtime/realtime.hub';

export type TraccarLinkState = 'disabled' | 'connecting' | 'connected' | 'reconnecting';

/**
 * Conexión WebSocket permanente con Traccar (/api/socket) con reconexión automática
 * (retroceso exponencial hasta 60 s). Recibe posiciones, cambios de estado y eventos,
 * los normaliza y los reparte por empresa.
 */
@Injectable()
export class TraccarSocket implements OnModuleInit, OnApplicationShutdown {
  private log = new Logger('TraccarSocket');
  private ws: WebSocket | null = null;
  private attempt = 0;
  private stopped = false;
  private timer: NodeJS.Timeout | null = null;
  state: TraccarLinkState = 'disabled';
  lastMessageAt: Date | null = null;

  /** Última posición conocida por traccarDeviceId */
  readonly latest = new Map<number, LivePosition>();
  readonly deviceStatus = new Map<number, TraccarDevice>();

  constructor(
    private client: TraccarClient,
    private registry: DeviceRegistry,
    private hub: RealtimeHub,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (!this.client.enabled) return;
    void this.bootstrap();
  }

  onApplicationShutdown() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
  }

  private async bootstrap() {
    try {
      const [positions, devices] = await Promise.all([this.client.latestPositions(), this.client.devices()]);
      devices.forEach((d) => this.deviceStatus.set(d.id, d));
      this.ingestPositions(positions);
    } catch (e) {
      this.log.warn(`Carga inicial desde Traccar fallida: ${(e as Error).message}`);
    }
    await this.connect();
  }

  private async connect() {
    if (this.stopped) return;
    this.state = this.attempt === 0 ? 'connecting' : 'reconnecting';
    try {
      const cookie = await this.client.sessionCookie(this.attempt > 0);
      const url = this.client.baseUrl.replace(/^http/, 'ws') + '/api/socket';
      const ws = new WebSocket(url, { headers: { Cookie: cookie } });
      this.ws = ws;
      ws.on('open', () => {
        this.attempt = 0;
        this.state = 'connected';
        this.log.log('WebSocket de Traccar conectado');
      });
      ws.on('message', (raw) => this.onMessage(raw.toString()));
      ws.on('close', () => this.scheduleReconnect());
      ws.on('error', (err) => this.log.warn(`WebSocket Traccar: ${err.message}`));
    } catch (e) {
      this.log.warn(`No fue posible conectar a Traccar: ${(e as Error).message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    this.state = 'reconnecting';
    const delay = Math.min(60_000, 1000 * 2 ** this.attempt++);
    this.log.warn(`Reconectando con Traccar en ${Math.round(delay / 1000)} s`);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.connect(), delay);
  }

  private onMessage(text: string) {
    this.lastMessageAt = new Date();
    let msg: { positions?: TraccarPosition[]; devices?: TraccarDevice[]; events?: TraccarEvent[] };
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg.devices) {
      for (const d of msg.devices) {
        this.deviceStatus.set(d.id, d);
        const ref = this.registry.get(d.id);
        if (ref) this.hub.toCompany(ref.companyId, 'device', { deviceId: ref.deviceId, status: d.status, lastUpdate: d.lastUpdate });
      }
    }
    if (msg.positions) this.ingestPositions(msg.positions);
    if (msg.events) {
      for (const ev of msg.events) {
        const ref = this.registry.get(ev.deviceId);
        if (ref) this.hub.toCompany(ref.companyId, 'event', { deviceId: ref.deviceId, vehicleId: ref.vehicleId, type: ev.type, eventTime: ev.eventTime, attributes: ev.attributes });
      }
    }
  }

  private ingestPositions(positions: TraccarPosition[]) {
    const byCompany = new Map<string, LivePosition[]>();
    for (const p of positions) {
      const ref = this.registry.get(p.deviceId);
      if (!ref) continue; // dispositivo no registrado en Flota Segura: se descarta
      const live = normalizePosition(p, ref.deviceId, ref.vehicleId);
      this.latest.set(p.deviceId, live);
      const list = byCompany.get(ref.companyId) ?? [];
      list.push(live);
      byCompany.set(ref.companyId, list);
      void this.prisma.device
        .update({ where: { id: ref.deviceId }, data: { lastPositionAt: new Date(p.fixTime) } })
        .catch(() => undefined);
    }
    for (const [companyId, list] of byCompany) this.hub.toCompany(companyId, 'positions', list);
  }
}
