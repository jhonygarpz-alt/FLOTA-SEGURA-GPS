import { DeviceStatus } from '@prisma/client';
import { LivePosition, TraccarDevice } from '../traccar/traccar.types';

export const STATUS_LABELS: Record<DeviceStatus, string> = {
  PENDING_CONFIG: 'Pendiente de configuración',
  WAITING: 'Esperando conexión',
  RECEIVING: 'Recibiendo datos',
  CONNECTED: 'Conectado correctamente',
  NO_COMMUNICATION: 'Sin comunicación',
  CONFIG_ERROR: 'Error de configuración',
};

/**
 * Diagnóstico basado únicamente en datos reales reportados por Traccar.
 * - Sin registro en Traccar -> pendiente.
 * - Registrado pero nunca ha transmitido -> esperando conexión.
 * - Conectado pero sin posición válida reciente -> recibiendo datos.
 * - Conectado con posición válida reciente -> conectado correctamente.
 * - Última comunicación más antigua que el umbral -> sin comunicación.
 */
export function deriveDeviceStatus(input: {
  traccarDeviceId: number | null;
  traccarDevice: TraccarDevice | null | undefined;
  lastPosition: LivePosition | null | undefined;
  offlineMinutes: number;
  now?: Date;
}): DeviceStatus {
  const now = input.now ?? new Date();
  const limit = input.offlineMinutes * 60_000;
  if (!input.traccarDeviceId) return 'PENDING_CONFIG';
  const td = input.traccarDevice;
  if (!td) return 'CONFIG_ERROR';
  if (!td.lastUpdate) return 'WAITING';
  const lastUpdateAge = now.getTime() - new Date(td.lastUpdate).getTime();
  const pos = input.lastPosition;
  const posFresh = pos ? now.getTime() - new Date(pos.fixTime).getTime() < limit : false;
  if (td.status === 'online' || lastUpdateAge < limit) {
    return pos && pos.valid && posFresh ? 'CONNECTED' : 'RECEIVING';
  }
  return 'NO_COMMUNICATION';
}
