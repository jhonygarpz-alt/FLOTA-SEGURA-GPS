import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { assertWritable, resolveCompanyId, tenantWhere } from '../common/tenant';
import { effectivePermissions, ROLE_LABELS } from '../common/permissions';

class CreateUserDto {
  @IsEmail() @MaxLength(200) email: string;
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsString() @MinLength(10, { message: 'La contraseña debe tener al menos 10 caracteres' }) @MaxLength(200) password: string;
  @IsEnum(Role) role: Role;
  @IsOptional() @IsUUID() companyId?: string;
}
class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsObject() permissions?: Record<string, boolean>;
}

const select = { id: true, email: true, name: true, role: true, active: true, mfaEnabled: true, lastLoginAt: true, companyId: true, permissions: true, createdAt: true } as const;

@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService, private audit: AuditService, private auth: AuthService) {}

  @Get()
  @RequirePermissions('users:read')
  async list(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) {
    const users = await this.prisma.user.findMany({ where: tenantWhere(user, companyId), select, orderBy: { name: 'asc' } });
    return users.map((u) => ({ ...u, roleLabel: ROLE_LABELS[u.role], effectivePermissions: effectivePermissions(u.role, u.permissions) }));
  }

  @Post()
  @RequirePermissions('users:write')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    assertWritable(user);
    if (dto.role === 'SUPERADMIN' && user.role !== 'SUPERADMIN') throw new ForbiddenException('Rol no permitido');
    const companyId = dto.role === 'SUPERADMIN' ? null : resolveCompanyId(user, dto.companyId);
    try {
      const u = await this.prisma.user.create({
        data: { email: dto.email.toLowerCase().trim(), name: dto.name, role: dto.role, companyId, passwordHash: await this.auth.hashPassword(dto.password) },
        select,
      });
      await this.audit.record({ companyId, userId: user.id, action: 'user.create', entity: 'User', entityId: u.id, metadata: { role: dto.role } });
      return u;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Ya existe un usuario con ese correo');
      throw e;
    }
  }

  @Patch(':id')
  @RequirePermissions('users:write')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    assertWritable(user);
    const target = await this.prisma.user.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!target) throw new NotFoundException('Usuario no encontrado');
    if (dto.role === 'SUPERADMIN' && user.role !== 'SUPERADMIN') throw new ForbiddenException('Rol no permitido');
    if (target.id === user.id && dto.active === false) throw new BadRequestException('No puede desactivar su propia cuenta');
    const u = await this.prisma.user.update({ where: { id }, data: dto, select });
    await this.audit.record({ companyId: target.companyId, userId: user.id, action: 'user.update', entity: 'User', entityId: id, metadata: { ...dto } });
    return u;
  }
}
