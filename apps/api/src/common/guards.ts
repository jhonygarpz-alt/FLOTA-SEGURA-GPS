import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import { IS_PUBLIC, REQUIRED_PERMISSIONS } from './decorators';
import { AuthUser, JwtPayload } from './auth-user';
import { effectivePermissions, Permission } from './permissions';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Sesión requerida');
    req.user = await authenticateToken(this.jwt, this.prisma, header.slice(7));
    return true;
  }
}

/** Valida un token de acceso y recarga el usuario (detecta usuarios desactivados o empresas suspendidas). */
export async function authenticateToken(jwt: JwtService, prisma: PrismaService, token: string): Promise<AuthUser> {
  let payload: JwtPayload;
  try {
    payload = await jwt.verifyAsync<JwtPayload>(token, { secret: env().JWT_ACCESS_SECRET });
  } catch {
    throw new UnauthorizedException('Sesión expirada o inválida');
  }
  if (payload.typ !== 'access') throw new UnauthorizedException('Token inválido');
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { company: true } });
  if (!user || !user.active) throw new UnauthorizedException('Usuario inactivo');
  if (user.company && user.company.status !== 'ACTIVE') throw new ForbiddenException('Empresa suspendida');
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    isDemo: user.company?.isDemo ?? false,
    permissions: effectivePermissions(user.role, user.permissions),
  };
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, [ctx.getHandler(), ctx.getClass()]);
    if (!required?.length) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) return false;
    const ok = required.every((p) => user.permissions.includes(p));
    if (!ok) throw new ForbiddenException('No cuenta con permisos para esta acción');
    return true;
  }
}
