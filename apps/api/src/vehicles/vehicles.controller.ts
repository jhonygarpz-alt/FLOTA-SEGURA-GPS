import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Prisma, VehicleStatus, VehicleType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { assertWritable, resolveCompanyId, tenantWhere } from '../common/tenant';

class VehicleDto {
  @IsString() @MinLength(1) @MaxLength(30) economicNumber: string;
  @IsOptional() @IsString() @MaxLength(15) plates?: string;
  @IsOptional() @IsString() @Matches(/^[A-HJ-NPR-Z0-9]{17}$/i, { message: 'El VIN debe tener 17 caracteres válidos' }) vin?: string;
  @IsOptional() @IsEnum(VehicleType) type?: VehicleType;
  @IsOptional() @IsString() @MaxLength(60) brand?: string;
  @IsOptional() @IsString() @MaxLength(60) model?: string;
  @IsOptional() @IsInt() @Min(1950) @Max(2100) year?: number;
  @IsOptional() @IsUrl({ require_tld: false }) photoUrl?: string;
  @IsOptional() @IsEnum(VehicleStatus) status?: VehicleStatus;
  @IsOptional() @IsUUID() operatorId?: string | null;
  @IsOptional() @IsUUID() companyId?: string;
}
class UpdateVehicleDto extends VehicleDto {
  @IsOptional() @IsString() declare economicNumber: string;
}

const include = { operator: { select: { id: true, name: true, phone: true } }, device: { select: { id: true, name: true, uniqueId: true, status: true, protocol: true, isDemo: true, traccarDeviceId: true } } } as const;

@Controller('vehicles')
export class VehiclesController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  @Get()
  @RequirePermissions('vehicles:read')
  list(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) {
    return this.prisma.vehicle.findMany({ where: tenantWhere(user, companyId), include, orderBy: { economicNumber: 'asc' } });
  }

  @Get(':id')
  @RequirePermissions('vehicles:read')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const v = await this.prisma.vehicle.findFirst({ where: { id, ...tenantWhere(user) }, include });
    if (!v) throw new NotFoundException('Unidad no encontrada');
    return v;
  }

  private async checkOperator(companyId: string, operatorId?: string | null) {
    if (!operatorId) return;
    const op = await this.prisma.operator.findFirst({ where: { id: operatorId, companyId } });
    if (!op) throw new BadRequestException('El operador no pertenece a la empresa');
  }

  @Post()
  @RequirePermissions('vehicles:write')
  async create(@CurrentUser() user: AuthUser, @Body() dto: VehicleDto) {
    assertWritable(user);
    const { companyId: requested, ...data } = dto;
    const companyId = resolveCompanyId(user, requested);
    await this.checkOperator(companyId, data.operatorId);
    try {
      const v = await this.prisma.vehicle.create({ data: { ...data, companyId }, include });
      await this.audit.record({ companyId, userId: user.id, action: 'vehicle.create', entity: 'Vehicle', entityId: v.id });
      return v;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Ya existe una unidad con ese número económico');
      throw e;
    }
  }

  @Patch(':id')
  @RequirePermissions('vehicles:write')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVehicleDto) {
    assertWritable(user);
    const found = await this.prisma.vehicle.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!found) throw new NotFoundException('Unidad no encontrada');
    const { companyId: _ignored, ...data } = dto;
    await this.checkOperator(found.companyId, data.operatorId);
    const v = await this.prisma.vehicle.update({ where: { id }, data, include });
    await this.audit.record({ companyId: found.companyId, userId: user.id, action: 'vehicle.update', entity: 'Vehicle', entityId: id, metadata: { ...data } });
    return v;
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('vehicles:write')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    assertWritable(user);
    const found = await this.prisma.vehicle.findFirst({ where: { id, ...tenantWhere(user) } });
    if (!found) throw new NotFoundException('Unidad no encontrada');
    await this.prisma.vehicle.delete({ where: { id } });
    await this.audit.record({ companyId: found.companyId, userId: user.id, action: 'vehicle.delete', entity: 'Vehicle', entityId: id });
  }
}
