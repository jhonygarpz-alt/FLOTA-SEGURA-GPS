import { Role } from '@prisma/client';

/**
 * Permisos granulares por módulo y acción. Cada rol tiene un conjunto base y
 * cada usuario puede tener concesiones/revocaciones individuales (User.permissions).
 */
export const PERMISSIONS = [
  'monitoring:read',
  'vehicles:read', 'vehicles:write',
  'devices:read', 'devices:write',
  'operators:read', 'operators:write',
  'users:read', 'users:write',
  'alerts:read', 'alerts:write',
  'geofences:read', 'geofences:write',
  'reports:read',
  'logbook:read', 'logbook:write',
  'commands:send', 'commands:approve',
  'audit:read',
  'company:settings',
  'platform:admin', // exclusivo SECUREFLEET CONSULTING
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const read: Permission[] = ['monitoring:read', 'vehicles:read', 'devices:read', 'operators:read', 'alerts:read', 'geofences:read', 'reports:read'];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPERADMIN: [...PERMISSIONS],
  COMPANY_ADMIN: PERMISSIONS.filter((p) => p !== 'platform:admin'),
  MANAGER: [...read, 'vehicles:write', 'operators:write', 'geofences:write', 'alerts:write', 'logbook:read', 'logbook:write', 'users:read', 'audit:read', 'commands:approve'],
  SUPERVISOR: [...read, 'alerts:write', 'logbook:read', 'logbook:write', 'commands:send', 'commands:approve'],
  MONITOR: [...read, 'alerts:write', 'logbook:read', 'logbook:write', 'commands:send'],
  INSTALLER: ['vehicles:read', 'devices:read', 'devices:write', 'monitoring:read'],
  VIEWER: [...read],
};

export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: 'Superadministrador',
  COMPANY_ADMIN: 'Administrador de empresa',
  MANAGER: 'Gerente',
  SUPERVISOR: 'Supervisor',
  MONITOR: 'Monitorista',
  INSTALLER: 'Instalador',
  VIEWER: 'Usuario de consulta',
};

export function effectivePermissions(role: Role, overrides: unknown): Permission[] {
  const set = new Set<Permission>(ROLE_PERMISSIONS[role]);
  if (overrides && typeof overrides === 'object') {
    for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
      if (!(PERMISSIONS as readonly string[]).includes(k) || k === 'platform:admin') continue;
      if (v === true) set.add(k as Permission);
      if (v === false) set.delete(k as Permission);
    }
  }
  return [...set];
}
