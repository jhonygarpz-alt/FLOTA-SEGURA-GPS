import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeHub } from '../realtime/realtime.hub';
import { LivePosition } from '../traccar/traccar.types';
import { env } from '../config/env';
import { DEMO_SCENARIOS, DemoScenario } from './scenarios';
import { lineLength, pointAlong } from './geo';

const TICK_MS = 3000;
const HISTORY_MS = 2 * 3600_000;

interface Sim {
  deviceId: string;
  vehicleId: string | null;
  companyId: string;
  scenario: DemoScenario;
  progress: number;
  direction: 1 | -1;
  length: number;
}

/** Simulador del modo demostración. Todas sus posiciones llevan source = 'demo'. */
@Injectable()
export class DemoService implements OnModuleInit, OnApplicationShutdown {
  private log = new Logger('Demo');
  private sims: Sim[] = [];
  private timer: NodeJS.Timeout | null = null;
  readonly latest = new Map<string, LivePosition>();
  private hist = new Map<string, LivePosition[]>();

  constructor(private prisma: PrismaService, private hub: RealtimeHub) {}

  async onModuleInit() {
    if (!env().DEMO_ENABLED) return;
    await this.load();
    if (process.env.NODE_ENV !== 'test') this.timer = setInterval(() => this.tick(new Date()), TICK_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async load() {
    const devices = await this.prisma.device.findMany({ where: { isDemo: true, company: { isDemo: true } } });
    this.sims = [];
    for (const d of devices) {
      const scenario = DEMO_SCENARIOS.find((s) => s.uniqueId === d.uniqueId);
      if (!scenario) continue;
      this.sims.push({ deviceId: d.id, vehicleId: d.vehicleId, companyId: d.companyId, scenario, progress: 0, direction: 1, length: scenario.route ? lineLength(scenario.route) : 0 });
    }
    // Historial sintético de las últimas 2 horas para la reproducción de recorridos.
    const now = Date.now();
    for (let t = now - HISTORY_MS; t <= now; t += TICK_MS * 10) this.tick(new Date(t), false, TICK_MS * 10);
    this.log.log(`Modo demostración activo con ${this.sims.length} unidades simuladas`);
  }

  private tick(now: Date, emit = true, stepMs = TICK_MS) {
    const byCompany = new Map<string, LivePosition[]>();
    for (const sim of this.sims) {
      const pos = this.step(sim, now, stepMs);
      this.latest.set(sim.deviceId, pos);
      const h = this.hist.get(sim.deviceId) ?? [];
      if (sim.scenario.kind !== 'offline') h.push(pos);
      while (h.length && new Date(h[0].fixTime).getTime() < now.getTime() - HISTORY_MS) h.shift();
      this.hist.set(sim.deviceId, h);
      const list = byCompany.get(sim.companyId) ?? [];
      list.push(pos);
      byCompany.set(sim.companyId, list);
    }
    if (emit) for (const [cid, list] of byCompany) this.hub.server?.to(`company:${cid}`).emit('positions', list);
  }

  private step(sim: Sim, now: Date, stepMs: number): LivePosition {
    const s = sim.scenario;
    let point = s.point ?? [0, 0];
    let course = 0;
    let speed = 0;
    let fixTime = now;
    if (s.kind === 'moving' && s.route) {
      speed = Math.max(0, (s.speedKmh ?? 50) + (Math.random() - 0.5) * 12);
      sim.progress += sim.direction * (speed / 3.6) * (stepMs / 1000);
      if (sim.progress >= sim.length) { sim.progress = sim.length; sim.direction = -1; }
      if (sim.progress <= 0) { sim.progress = 0; sim.direction = 1; }
      const along = pointAlong(s.route, sim.progress);
      point = along.point;
      course = sim.direction === 1 ? along.course : (along.course + 180) % 360;
    }
    if (s.kind === 'offline') fixTime = new Date(now.getTime() - (s.offlineHours ?? 3) * 3600_000);
    const iso = fixTime.toISOString();
    return {
      deviceId: sim.deviceId,
      vehicleId: sim.vehicleId,
      latitude: point[1],
      longitude: point[0],
      speedKmh: Math.round(speed * 10) / 10,
      course: Math.round(course),
      altitude: 2240,
      fixTime: iso,
      serverTime: iso,
      valid: true,
      outdated: false,
      address: null,
      ignition: s.kind === 'moving' || s.kind === 'idle',
      motion: s.kind === 'moving',
      alarm: s.alarm ?? null,
      powerVolts: s.kind === 'alert' ? 0 : 26.8,
      batteryVolts: 4.1,
      batteryLevel: null,
      fuel: s.fuel ?? null,
      source: 'demo',
    };
  }

  history(deviceId: string, from: Date, to: Date) {
    return (this.hist.get(deviceId) ?? []).filter((p) => {
      const t = new Date(p.fixTime).getTime();
      return t >= from.getTime() && t <= to.getTime();
    });
  }
}
