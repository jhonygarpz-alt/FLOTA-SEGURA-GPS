import { deriveDeviceStatus } from './device-status';
import { TraccarDevice, LivePosition } from '../traccar/traccar.types';

const now = new Date('2026-11-17T12:00:00Z');
const td = (over: Partial<TraccarDevice>): TraccarDevice => ({ id: 1, name: 'x', uniqueId: '1', status: 'online', disabled: false, lastUpdate: now.toISOString(), positionId: 1, groupId: 0, attributes: {}, ...over });
const pos = (minutesAgo: number, valid = true) => ({ fixTime: new Date(now.getTime() - minutesAgo * 60_000).toISOString(), valid }) as LivePosition;

describe('deriveDeviceStatus', () => {
  const base = { offlineMinutes: 10, now };
  it('sin registro en Traccar => pendiente', () => {
    expect(deriveDeviceStatus({ ...base, traccarDeviceId: null, traccarDevice: null, lastPosition: null })).toBe('PENDING_CONFIG');
  });
  it('registrado pero eliminado en Traccar => error de configuración', () => {
    expect(deriveDeviceStatus({ ...base, traccarDeviceId: 1, traccarDevice: null, lastPosition: null })).toBe('CONFIG_ERROR');
  });
  it('nunca ha transmitido => esperando conexión', () => {
    expect(deriveDeviceStatus({ ...base, traccarDeviceId: 1, traccarDevice: td({ status: 'unknown', lastUpdate: null }), lastPosition: null })).toBe('WAITING');
  });
  it('en línea sin posición válida => recibiendo datos', () => {
    expect(deriveDeviceStatus({ ...base, traccarDeviceId: 1, traccarDevice: td({}), lastPosition: pos(1, false) })).toBe('RECEIVING');
  });
  it('en línea con posición válida reciente => conectado', () => {
    expect(deriveDeviceStatus({ ...base, traccarDeviceId: 1, traccarDevice: td({}), lastPosition: pos(1) })).toBe('CONNECTED');
  });
  it('última comunicación antigua => sin comunicación', () => {
    const old = new Date(now.getTime() - 60 * 60_000).toISOString();
    expect(deriveDeviceStatus({ ...base, traccarDeviceId: 1, traccarDevice: td({ status: 'offline', lastUpdate: old }), lastPosition: pos(60) })).toBe('NO_COMMUNICATION');
  });
});
