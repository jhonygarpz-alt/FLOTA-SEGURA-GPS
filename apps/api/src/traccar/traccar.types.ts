/** Tipos de la API REST de Traccar 6.x (https://www.traccar.org/api-reference/). */
export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline' | 'unknown';
  disabled: boolean;
  lastUpdate: string | null;
  positionId: number;
  groupId: number;
  phone?: string | null;
  model?: string | null;
  category?: string | null;
  attributes: Record<string, unknown>;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  protocol: string;
  serverTime: string;
  deviceTime: string;
  fixTime: string;
  outdated: boolean;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number; // nudos
  course: number;
  address: string | null;
  accuracy: number;
  attributes: Record<string, unknown>;
}

export interface TraccarEvent {
  id: number;
  type: string;
  eventTime: string;
  deviceId: number;
  positionId: number;
  geofenceId: number;
  maintenanceId: number;
  attributes: Record<string, unknown>;
}

export interface TraccarGroup {
  id: number;
  name: string;
  groupId: number;
  attributes: Record<string, unknown>;
}

/** Posición normalizada que consume el frontend (km/h, UTC ISO). */
export interface LivePosition {
  deviceId: string;
  vehicleId: string | null;
  latitude: number;
  longitude: number;
  speedKmh: number;
  course: number;
  altitude: number;
  fixTime: string;
  serverTime: string;
  valid: boolean;
  outdated: boolean;
  address: string | null;
  ignition: boolean | null;
  motion: boolean | null;
  alarm: string | null;
  powerVolts: number | null;
  batteryVolts: number | null;
  batteryLevel: number | null;
  fuel: number | null;
  source: 'traccar' | 'demo';
}

export const KNOTS_TO_KMH = 1.852;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

export function normalizePosition(p: TraccarPosition, deviceId: string, vehicleId: string | null): LivePosition {
  const a = p.attributes ?? {};
  return {
    deviceId,
    vehicleId,
    latitude: p.latitude,
    longitude: p.longitude,
    speedKmh: Math.round(p.speed * KNOTS_TO_KMH * 10) / 10,
    course: p.course,
    altitude: p.altitude,
    fixTime: p.fixTime,
    serverTime: p.serverTime,
    valid: p.valid,
    outdated: p.outdated,
    address: p.address,
    ignition: bool(a.ignition),
    motion: bool(a.motion),
    alarm: typeof a.alarm === 'string' ? a.alarm : null,
    powerVolts: num(a.power),
    batteryVolts: num(a.battery),
    batteryLevel: num(a.batteryLevel),
    fuel: num(a.fuel),
    source: 'traccar',
  };
}
