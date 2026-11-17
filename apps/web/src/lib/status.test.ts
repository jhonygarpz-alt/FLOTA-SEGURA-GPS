import { describe, expect, it } from 'vitest';
import { vehicleState } from './status';
import type { LivePosition } from './types';

const now = Date.parse('2026-11-17T12:00:00Z');
const p = (o: Partial<LivePosition>): LivePosition =>
  ({ fixTime: new Date(now - 60_000).toISOString(), speedKmh: 0, ignition: null, alarm: null, ...o }) as LivePosition;

describe('vehicleState', () => {
  it('sin posición => sin datos (nunca se inventa)', () => expect(vehicleState(null, 10, now)).toBe('nodata'));
  it('posición antigua => sin comunicación', () => expect(vehicleState(p({ fixTime: new Date(now - 3600_000).toISOString(), speedKmh: 80 }), 10, now)).toBe('offline'));
  it('alarma crítica => alerta', () => expect(vehicleState(p({ alarm: 'sos', speedKmh: 50 }), 10, now)).toBe('alert'));
  it('velocidad => en movimiento', () => expect(vehicleState(p({ speedKmh: 40 }), 10, now)).toBe('moving'));
  it('motor encendido sin velocidad => detenido', () => expect(vehicleState(p({ ignition: true }), 10, now)).toBe('idle'));
  it('sin ignición => estacionado', () => expect(vehicleState(p({ ignition: false }), 10, now)).toBe('parked'));
});
