import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { tenantWhere } from '../common/tenant';

@Controller('audit')
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit:read')
  list(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) {
    return this.prisma.auditLog.findMany({
      where: tenantWhere(user, companyId),
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
