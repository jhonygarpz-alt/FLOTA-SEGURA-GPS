import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { assertWritable, resolveCompanyId, tenantWhere } from '../common/tenant';

class OperatorDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(40) license?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsUUID() companyId?: string;
}
class UpdateOperatorDto extends OperatorDto {
  @IsOptional() @IsString() declare name: string;
}

@Controller('operators')
export class OperatorsController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  @Get()
  @RequirePermissions('operators:read')
  list(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) {
    return this.prisma.operator.findMany({ where: tenantWhere(user, companyId), orderBy: { name: 'asc' }, include: { vehicles: { select: { id: true, economicNumber: true } } } });
  }

  @Post()
  @RequirePermissions('operators:write')
  async create(@CurrentUser() user: AuthUser, @Body() dto: OperatorDto) {
    assertWritable(user);
    const { companyId: requested, ...data } = dto;
    const companyId = resolveCompanyId(user, requested);
    const o = await this.prisma.operator.create({ data: { ...data, companyId } });
    await this.audit.record({ companyId, userId: user.id, action: 'operator.create', entity: 'Operator', entityId: o.id });
    return o;
  }

  @Patch(':id')
  @RequirePermissions('operators:write')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOperatorDto) {
    assertWritable(user);
    const found = await this.prisma.operator.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!found) throw new NotFoundException('Operador no encontrado');
    const { companyId: _ignored, ...data } = dto;
    return this.prisma.operator.update({ where: { id }, data });
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('operators:write')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    assertWritable(user);
    const found = await this.prisma.operator.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!found) throw new NotFoundException('Operador no encontrado');
    await this.prisma.operator.delete({ where: { id } });
    await this.audit.record({ companyId: found.companyId, userId: user.id, action: 'operator.delete', entity: 'Operator', entityId: id });
  }
}
