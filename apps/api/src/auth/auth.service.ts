import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { User, Company } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { env } from '../config/env';
import { JwtPayload } from '../common/auth-user';
import { effectivePermissions, ROLE_LABELS } from '../common/permissions';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export interface ClientInfo { ip?: string; userAgent?: string }
export interface IssuedTokens { accessToken: string; refreshToken: string; refreshExpires: Date }

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private audit: AuditService) {
    authenticator.options = { window: 1 };
  }

  hashPassword(p: string) {
    return argon2.hash(p, { type: argon2.argon2id });
  }

  async login(email: string, password: string, client: ClientInfo) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() }, include: { company: true } });
    // Respuesta genérica para no revelar si el correo existe.
    const invalid = new UnauthorizedException('Correo o contraseña incorrectos');
    if (!user || !user.active) {
      await argon2.hash('timing-equalizer').catch(() => undefined);
      throw invalid;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde.');
    }
    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) {
      const failed = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
      });
      await this.audit.record({ companyId: user.companyId, userId: user.id, action: 'auth.login_failed', ip: client.ip });
      throw invalid;
    }
    this.assertCompanyActive(user);
    if (user.mfaEnabled) {
      const mfaToken = await this.jwt.signAsync(
        { sub: user.id, role: user.role, cid: user.companyId, demo: false, typ: 'mfa' } satisfies JwtPayload,
        { secret: env().JWT_ACCESS_SECRET, expiresIn: '5m' },
      );
      return { mfaRequired: true as const, mfaToken };
    }
    return this.completeLogin(user, client);
  }

  async verifyMfa(mfaToken: string, code: string, client: ClientInfo) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(mfaToken, { secret: env().JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('La verificación expiró, inicie sesión nuevamente');
    }
    if (payload.typ !== 'mfa') throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { company: true } });
    if (!user?.mfaSecret || !user.active) throw new UnauthorizedException();
    if (!authenticator.check(code, user.mfaSecret)) {
      await this.audit.record({ companyId: user.companyId, userId: user.id, action: 'auth.mfa_failed', ip: client.ip });
      throw new UnauthorizedException('Código de verificación incorrecto');
    }
    return this.completeLogin(user, client);
  }

  /** Acceso al modo demostración: usuario de solo lectura de la empresa demo. */
  async demoLogin(client: ClientInfo) {
    if (!env().DEMO_ENABLED) throw new ForbiddenException('Modo demostración deshabilitado');
    const user = await this.prisma.user.findFirst({
      where: { company: { isDemo: true }, role: 'VIEWER', active: true },
      include: { company: true },
    });
    if (!user) throw new BadRequestException('Modo demostración no inicializado (ejecute el seed)');
    return this.completeLogin(user, client);
  }

  private assertCompanyActive(user: User & { company: Company | null }) {
    if (user.company && user.company.status !== 'ACTIVE') {
      throw new ForbiddenException('El servicio de su empresa está suspendido. Contacte a SECUREFLEET CONSULTING.');
    }
  }

  private async completeLogin(user: User & { company: Company | null }, client: ClientInfo) {
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.audit.record({ companyId: user.companyId, userId: user.id, action: 'auth.login', ip: client.ip });
    const tokens = await this.issueTokens(user, client);
    return { mfaRequired: false as const, ...tokens, user: await this.profile(user.id) };
  }

  private async issueTokens(user: User & { company: Company | null }, client: ClientInfo): Promise<IssuedTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, cid: user.companyId, demo: user.company?.isDemo ?? false, typ: 'access' } satisfies JwtPayload,
      { secret: env().JWT_ACCESS_SECRET, expiresIn: env().ACCESS_TOKEN_TTL as any },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpires = new Date(Date.now() + env().REFRESH_TOKEN_DAYS * 86_400_000);
    await this.prisma.refreshSession.create({
      data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpires, ip: client.ip, userAgent: client.userAgent?.slice(0, 300) },
    });
    return { accessToken, refreshToken, refreshExpires };
  }

  /** Rotación de refresh token: cada uso invalida el anterior. Reutilizar uno revocado revoca todas las sesiones. */
  async refresh(refreshToken: string | undefined, client: ClientInfo) {
    if (!refreshToken) throw new UnauthorizedException('Sesión expirada');
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { include: { company: true } } },
    });
    if (!session) throw new UnauthorizedException('Sesión expirada');
    if (session.revokedAt) {
      await this.prisma.refreshSession.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.record({ companyId: session.user.companyId, userId: session.userId, action: 'auth.refresh_reuse_detected', ip: client.ip });
      throw new UnauthorizedException('Sesión inválida');
    }
    if (session.expiresAt < new Date() || !session.user.active) throw new UnauthorizedException('Sesión expirada');
    this.assertCompanyActive(session.user);
    await this.prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    const tokens = await this.issueTokens(session.user, client);
    return { ...tokens, user: await this.profile(session.userId) };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await this.prisma.refreshSession.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async profile(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { company: true } });
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      roleLabel: ROLE_LABELS[u.role],
      mfaEnabled: u.mfaEnabled,
      permissions: effectivePermissions(u.role, u.permissions),
      company: u.company ? { id: u.company.id, name: u.company.name, isDemo: u.company.isDemo, timezone: u.company.timezone } : null,
    };
  }

  async mfaSetup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { company: true } });
    if (user.company?.isDemo) throw new ForbiddenException('No disponible en modo demostración');
    if (user.mfaEnabled) throw new BadRequestException('La verificación en dos pasos ya está activa');
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });
    const otpauth = authenticator.keyuri(user.email, 'Flota Segura GPS', secret);
    return { secret, otpauth, qr: await QRCode.toDataURL(otpauth) };
  }

  async mfaEnable(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret || !authenticator.check(code, user.mfaSecret)) throw new BadRequestException('Código incorrecto');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    await this.audit.record({ companyId: user.companyId, userId, action: 'auth.mfa_enabled' });
    return { ok: true };
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { company: true } });
    if (user.company?.isDemo) throw new ForbiddenException('No disponible en modo demostración');
    if (!(await argon2.verify(user.passwordHash, current))) throw new BadRequestException('La contraseña actual es incorrecta');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.hashPassword(next) } });
    await this.prisma.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record({ companyId: user.companyId, userId, action: 'auth.password_changed' });
    return { ok: true };
  }
}
