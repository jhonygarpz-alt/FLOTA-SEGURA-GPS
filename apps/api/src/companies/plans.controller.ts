import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../common/decorators';

@Controller('admin/plans')
@RequirePermissions('platform:admin')
export class PlansController {
  constructor(private prisma: PrismaService) {}
  @Get()
  list() {
    return this.prisma.plan.findMany({ orderBy: { priceMxn: 'asc' } });
  }
}
