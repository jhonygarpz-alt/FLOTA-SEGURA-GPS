import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, getAccessToken } from './api';
import { useAuth } from './auth';
import type { FleetVehicle, LivePosition } from './types';

export type LinkState = 'connecting' | 'online' | 'reconnecting' | 'offline';

interface FleetState {
  vehicles: FleetVehicle[];
  offlineMinutes: number;
  loading: boolean;
  error: string | null;
  link: LinkState;
  refresh: () => Promise<void>;
  now: number;
}

const Ctx = createContext<FleetState | null>(null);

/**
 * Estado de la flota: carga inicial por REST y actualizaciones por WebSocket
 * (Socket.IO con reconexión automática). Al reconectar se recarga la flota completa.
 */
export function FleetProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [offlineMinutes, setOffline] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<LinkState>('connecting');
  const [now, setNow] = useState(Date.now());
  const socketRef = useRef<Socket | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await api<{ vehicles: FleetVehicle[]; offlineMinutes: number }>('/monitoring/fleet');
      setVehicles(d.vehicles);
      setOffline(d.offlineMinutes);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh();
    const socket = io({
      path: '/api/socket.io',
      transports: ['websocket'],
      auth: (cb) => cb({ token: getAccessToken() }),
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
    });
    socketRef.current = socket;
    socket.on('ready', () => setLink('online'));
    socket.on('disconnect', () => setLink('reconnecting'));
    socket.io.on('reconnect_attempt', () => setLink('reconnecting'));
    socket.io.on('reconnect', () => void refresh());
    socket.on('connect_error', () => setLink('reconnecting'));
    socket.on('unauthorized', () => setLink('offline'));
    socket.on('positions', (list: LivePosition[]) => {
      if (!Array.isArray(list)) return;
      const byDevice = new Map(list.map((p) => [p.deviceId, p]));
      setVehicles((prev) => prev.map((v) => (v.device && byDevice.has(v.device.id) ? { ...v, position: byDevice.get(v.device.id)! } : v)));
    });
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [user, refresh]);

  const value = useMemo(() => ({ vehicles, offlineMinutes, loading, error, link, refresh, now }), [vehicles, offlineMinutes, loading, error, link, refresh, now]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFleet() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFleet fuera de FleetProvider');
  return c;
}
