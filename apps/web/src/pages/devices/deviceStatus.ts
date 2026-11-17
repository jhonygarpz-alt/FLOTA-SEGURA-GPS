import type { DeviceStatus } from '../../lib/types';

export const DEVICE_STATUS: Record<DeviceStatus, { label: string; color: string; hint: string }> = {
  PENDING_CONFIG: { label: 'Pendiente de configuración', color: '#6B7280', hint: 'El equipo aún no está registrado en el servidor de rastreo.' },
  WAITING: { label: 'Esperando conexión', color: '#0891B2', hint: 'Registrado. Esperando la primera transmisión del equipo.' },
  RECEIVING: { label: 'Recibiendo datos', color: '#CA8A04', hint: 'El equipo se comunica, pero aún no envía una posición GPS válida (puede estar bajo techo).' },
  CONNECTED: { label: 'Conectado correctamente', color: '#16A34A', hint: 'El equipo transmite posiciones válidas.' },
  NO_COMMUNICATION: { label: 'Sin comunicación', color: '#3F4A50', hint: 'No se reciben datos recientes. Revise energía, SIM, saldo de datos y cobertura.' },
  CONFIG_ERROR: { label: 'Error de configuración', color: '#DC2626', hint: 'No se pudo registrar en el servidor de rastreo o fue eliminado. Reintente la sincronización.' },
};
