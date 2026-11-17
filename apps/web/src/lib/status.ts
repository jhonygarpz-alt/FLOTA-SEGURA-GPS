import type { FleetVehicle, LivePosition } from './types';

export type VehicleState = 'moving' | 'idle' | 'parked' | 'alert' | 'offline' | 'nodata';

export const STATE_META: Record<VehicleState, { label: string; short: string; color: string; symbol: string }> = {
  moving: { label: 'En movimiento', short: 'Movimiento', color: '#16A34A', symbol: '▲' },
  idle: { label: 'Detenido con motor encendido', short: 'Detenido', color: '#CA8A04', symbol: '■' },
  parked: { label: 'Estacionado', short: 'Estacionado', color: '#8B949E', symbol: 'P' },
  alert: { label: 'Alerta crítica', short: 'Alerta', color: '#DC2626', symbol: '!' },
  offline: { label: 'Sin comunicación', short: 'Sin comunicación', color: '#3F4A50', symbol: '×' },
  nodata: { label: 'Sin datos de ubicación', short: 'Sin datos', color: '#3F4A50', symbol: '–' },
};

/** Alarmas de Traccar consideradas críticas para el color rojo. */
const CRITICAL_ALARMS = new Set(['sos', 'powerCut', 'tampering', 'jamming', 'accident', 'removing', 'powerOff']);

export const MOVING_THRESHOLD_KMH = 3;

/** El estado se deriva únicamente de la última posición real; sin posición => "sin datos". */
export function vehicleState(p: LivePosition | null | undefined, offlineMinutes: number, now = Date.now()): VehicleState {
  if (!p) return 'nodata';
  if (now - new Date(p.fixTime).getTime() > offlineMinutes * 60_000) return 'offline';
  if (p.alarm && CRITICAL_ALARMS.has(p.alarm)) return 'alert';
  if (p.speedKmh > MOVING_THRESHOLD_KMH) return 'moving';
  if (p.ignition === true) return 'idle';
  return 'parked';
}

export const ALARM_LABELS: Record<string, string> = {
  sos: 'Botón de pánico',
  powerCut: 'Desconexión eléctrica',
  tampering: 'Manipulación del equipo',
  jamming: 'Posible inhibición de señal',
  accident: 'Posible accidente',
  removing: 'Retiro del equipo',
  powerOff: 'Equipo apagado',
  overspeed: 'Exceso de velocidad',
  lowBattery: 'Batería baja',
};

export function countByState(vehicles: FleetVehicle[], offlineMinutes: number) {
  const c: Record<VehicleState, number> = { moving: 0, idle: 0, parked: 0, alert: 0, offline: 0, nodata: 0 };
  for (const v of vehicles) c[vehicleState(v.position, offlineMinutes)]++;
  return c;
}
