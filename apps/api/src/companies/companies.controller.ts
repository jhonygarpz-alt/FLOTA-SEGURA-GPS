import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CompanyStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/auth-user';

class CreateCompanyDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @IsString() @MaxLength(13) rfc?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(60) timezone?: string;
}
class UpdateCompanyDto extends CreateCompanyDto {
  @IsOptional() @IsString() declare name: string;
  @IsOptional() @IsEnum(CompanyStatus) status?: CompanyStatus;
}

/** Panel exclusivo de SECUREFLEET CONSULTING: administración de empresas clientes. */
@Controller('admin/companies')
@RequirePermissions('platform:admin')
export class CompaniesController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  @Get()
  list() {
    return this.prisma.company.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true, vehicles: true, devices: true } }, subscription: { include: { plan: true } } },
    });
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const c = await this.prisma.company.findUnique({ where: { id }, include: { subscription: { include: { plan: true } } } });
    if (!c) throw new NotFoundException('Empresa no encontrada');
    return c;
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateCompanyDto) {
    const c = await this.prisma.company.create({ data: dto });
    await this.audit.record({ companyId: c.id, userId: user.id, action: 'company.create', entity: 'Company', entityId: c.id });
    return c;
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) {
    const c = await this.prisma.company.update({ where: { id }, data: dto });
    await this.audit.record({ companyId: id, userId: user.id, action: 'company.update', entity: 'Company', entityId: id, metadata: { ...dto } });
    return c;
  }
}
