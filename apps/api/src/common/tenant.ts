import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthUser } from './auth-user';

/**
 * Resuelve la empresa sobre la que opera una solicitud.
 * - Usuarios de empresa: SIEMPRE su propia empresa; se ignora cualquier companyId enviado.
 * - Superadministrador: debe indicar explícitamente la empresa destino.
 */
export function resolveCompanyId(user: AuthUser, requested?: string | null): string {
  if (user.role === 'SUPERADMIN') {
    if (!requested) throw new BadRequestException('Indique la empresa (companyId)');
    return requested;
  }
  if (!user.companyId) throw new ForbiddenException('Usuario sin empresa asignada');
  return user.companyId;
}

/** Filtro de lectura: superadmin ve todo (o una empresa si la indica); los demás solo su empresa. */
export function tenantWhere(user: AuthUser, requested?: string | null): { companyId?: string } {
  if (user.role === 'SUPERADMIN') return requested ? { companyId: requested } : {};
  if (!user.companyId) throw new ForbiddenException('Usuario sin empresa asignada');
  return { companyId: user.companyId };
}

export function assertWritable(user: AuthUser) {
  if (user.isDemo) throw new ForbiddenException('El modo demostración es de solo lectura');
}
