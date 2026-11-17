import {
  BarChart3, Building2, ClipboardList, Fence, Fuel, LucideIcon, MapPin, Route, SatelliteDish, Settings, ShieldAlert, ShieldCheck, Truck, UserRound, Users, Video,
} from 'lucide-react';

export interface AppModule {
  key: string;
  name: string;
  path: string;
  icon: LucideIcon;
  color: string;
  permission?: string;
  /** Fase del plan en la que el módulo queda operativo (1–2 = disponible ahora). */
  phase: number;
  description: string;
}

export const MODULES: AppModule[] = [
  { key: 'monitoring', name: 'Monitoreo', path: '/mapa', icon: MapPin, color: '#0B5966', permission: 'monitoring:read', phase: 2, description: 'Ubicación de la flota en tiempo real' },
  { key: 'vehicles', name: 'Unidades', path: '/unidades', icon: Truck, color: '#2563EB', permission: 'vehicles:read', phase: 1, description: 'Tractocamiones, autotanques y más' },
  { key: 'trips', name: 'Recorridos', path: '/recorridos', icon: Route, color: '#7C3AED', permission: 'monitoring:read', phase: 3, description: 'Historial y reproducción de rutas' },
  { key: 'alerts', name: 'Alertas', path: '/alertas', icon: ShieldAlert, color: '#DC2626', permission: 'alerts:read', phase: 3, description: 'Centro de alertas y eventos' },
  { key: 'geofences', name: 'Geocercas', path: '/geocercas', icon: Fence, color: '#EA580C', permission: 'geofences:read', phase: 3, description: 'Zonas, patios y rutas autorizadas' },
  { key: 'fuel', name: 'Combustible', path: '/combustible', icon: Fuel, color: '#16A34A', permission: 'reports:read', phase: 5, description: 'Sensores, cargas y rendimiento' },
  { key: 'cameras', name: 'Cámaras', path: '/camaras', icon: Video, color: '#4F46E5', permission: 'monitoring:read', phase: 5, description: 'Dashcams, MDVR, ADAS y DMS' },
  { key: 'devices', name: 'Dispositivos', path: '/dispositivos', icon: SatelliteDish, color: '#0891B2', permission: 'devices:read', phase: 2, description: 'Equipos GPS y asistente de conexión' },
  { key: 'operators', name: 'Operadores', path: '/operadores', icon: UserRound, color: '#0D9488', permission: 'operators:read', phase: 1, description: 'Directorio de operadores' },
  { key: 'logbook', name: 'Bitácora', path: '/bitacora', icon: ClipboardList, color: '#6B7280', permission: 'logbook:read', phase: 3, description: 'Turnos y bitácora de monitoristas' },
  { key: 'protocols', name: 'Protocolos', path: '/protocolos', icon: ShieldCheck, color: '#F97316', permission: 'logbook:read', phase: 3, description: 'Protocolos de emergencia paso a paso' },
  { key: 'reports', name: 'Reportes', path: '/reportes', icon: BarChart3, color: '#9333EA', permission: 'reports:read', phase: 3, description: 'Indicadores y exportación' },
  { key: 'clients', name: 'Clientes', path: '/clientes', icon: Building2, color: '#1D4ED8', permission: 'platform:admin', phase: 1, description: 'Empresas, planes y suscripciones' },
  { key: 'users', name: 'Usuarios', path: '/usuarios', icon: Users, color: '#15803D', permission: 'users:read', phase: 1, description: 'Usuarios, roles y permisos' },
  { key: 'settings', name: 'Configuración', path: '/configuracion', icon: Settings, color: '#374151', phase: 1, description: 'Perfil, seguridad y apariencia' },
];

export const AVAILABLE_PHASE = 2;
export const moduleByKey = (k: string) => MODULES.find((m) => m.key === k)!;
