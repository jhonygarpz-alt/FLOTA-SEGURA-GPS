import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, ClientInfo } from './auth.service';
import { ChangePasswordDto, LoginDto, MfaCodeDto, MfaVerifyDto } from './dto';
import { CurrentUser, Public } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { env } from '../config/env';

const COOKIE = 'fs_refresh';
const AUTH_LIMIT = Number(process.env.AUTH_RATE_LIMIT ?? 10);

function client(req: Request): ClientInfo {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  private setCookie(res: Response, token: string, expires: Date) {
    res.cookie(COOKIE, token, {
      httpOnly: true,
      secure: env().NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      expires,
    });
  }

  private send(res: Response, r: { accessToken: string; refreshToken: string; refreshExpires: Date; user: unknown }) {
    this.setCookie(res, r.refreshToken, r.refreshExpires);
    return { accessToken: r.accessToken, user: r.user };
  }

  @Public()
  @Throttle({ default: { limit: AUTH_LIMIT, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.login(dto.email, dto.password, client(req));
    if (r.mfaRequired) return { mfaRequired: true, mfaToken: r.mfaToken };
    return { mfaRequired: false, ...this.send(res, r) };
  }

  @Public()
  @Throttle({ default: { limit: AUTH_LIMIT, ttl: 60_000 } })
  @Post('mfa/verify')
  @HttpCode(200)
  async mfaVerify(@Body() dto: MfaVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.verifyMfa(dto.mfaToken, dto.code, client(req));
    return this.send(res, r);
  }

  @Public()
  @Throttle({ default: { limit: AUTH_LIMIT, ttl: 60_000 } })
  @Post('demo')
  @HttpCode(200)
  async demo(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.auth.demoLogin(client(req)));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.auth.refresh(req.cookies?.[COOKIE], client(req)));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, { path: '/api/auth' });
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.profile(user.id);
  }

  @Post('mfa/setup')
  mfaSetup(@CurrentUser() user: AuthUser) {
    return this.auth.mfaSetup(user.id);
  }

  @Post('mfa/enable')
  @HttpCode(200)
  mfaEnable(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto) {
    return this.auth.mfaEnable(user.id, dto.code);
  }

  @Post('password')
  @HttpCode(200)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
