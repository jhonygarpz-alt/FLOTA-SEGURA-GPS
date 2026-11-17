import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { env, traccarConfigured } from '../config/env';
import { TraccarDevice, TraccarEvent, TraccarGroup, TraccarPosition } from './traccar.types';

/**
 * Cliente REST de Traccar. Las credenciales administrativas viven solo en el backend
 * (variables de entorno) y nunca se exponen al frontend.
 * Autenticación: sesión por cookie (POST /api/session), renovada automáticamente.
 */
@Injectable()
export class TraccarClient {
  private log = new Logger('Traccar');
  private cookie: string | null = null;
  private loginPromise: Promise<string> | null = null;

  get enabled() {
    return traccarConfigured();
  }

  get baseUrl() {
    return env().TRACCAR_URL!.replace(/\/+$/, '');
  }

  private ensureEnabled() {
    if (!this.enabled) throw new ServiceUnavailableException('El servidor Traccar no está configurado');
  }

  async sessionCookie(force = false): Promise<string> {
    this.ensureEnabled();
    if (this.cookie && !force) return this.cookie;
    if (!this.loginPromise) {
      this.loginPromise = (async () => {
        const body = new URLSearchParams({ email: env().TRACCAR_ADMIN_EMAIL!, password: env().TRACCAR_ADMIN_PASSWORD! });
        const res = await fetch(`${this.baseUrl}/api/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new ServiceUnavailableException(`Traccar rechazó el inicio de sesión (${res.status})`);
        const setCookie = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
        const jsession = setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('JSESSIONID='));
        if (!jsession) throw new ServiceUnavailableException('Traccar no devolvió cookie de sesión');
        this.cookie = jsession;
        this.log.log('Sesión administrativa con Traccar establecida');
        return jsession;
      })().finally(() => (this.loginPromise = null));
    }
    return this.loginPromise;
  }

  async request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
    const cookie = await this.sessionCookie();
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Cookie: cookie, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      throw new ServiceUnavailableException(`No hay comunicación con Traccar: ${(e as Error).message}`);
    }
    if (res.status === 401 && retry) {
      await this.sessionCookie(true);
      return this.request<T>(method, path, body, false);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new TraccarError(res.status, text.slice(0, 300));
    }
    if (res.status === 204) return undefined as T;
    const ct = res.headers.get('content-type') ?? '';
    return (ct.includes('json') ? res.json() : res.text()) as Promise<T>;
  }

  server() {
    return this.request<Record<string, unknown>>('GET', '/api/server');
  }

  devices() {
    return this.request<TraccarDevice[]>('GET', '/api/devices');
  }

  device(id: number) {
    return this.request<TraccarDevice[]>('GET', `/api/devices?id=${id}`).then((r) => r[0] ?? null);
  }

  createDevice(d: { name: string; uniqueId: string; groupId?: number; model?: string; phone?: string }) {
    return this.request<TraccarDevice>('POST', '/api/devices', { ...d, attributes: {} });
  }

  updateDevice(d: TraccarDevice) {
    return this.request<TraccarDevice>('PUT', `/api/devices/${d.id}`, d);
  }

  deleteDevice(id: number) {
    return this.request<void>('DELETE', `/api/devices/${id}`);
  }

  createGroup(name: string) {
    return this.request<TraccarGroup>('POST', '/api/groups', { name, attributes: {} });
  }

  latestPositions() {
    return this.request<TraccarPosition[]>('GET', '/api/positions');
  }

  route(deviceId: number, from: Date, to: Date) {
    const q = new URLSearchParams({ deviceId: String(deviceId), from: from.toISOString(), to: to.toISOString() });
    return this.request<TraccarPosition[]>('GET', `/api/reports/route?${q}`);
  }

  events(deviceId: number, from: Date, to: Date) {
    const q = new URLSearchParams({ deviceId: String(deviceId), from: from.toISOString(), to: to.toISOString() });
    return this.request<TraccarEvent[]>('GET', `/api/reports/events?${q}`);
  }
}

export class TraccarError extends Error {
  constructor(public status: number, public body: string) {
    super(`Traccar respondió ${status}: ${body}`);
  }
}
