import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { DevicesService } from './devices.service';
import { CatalogService, PRIORITY_MODELS } from './catalog.service';
import { CreateDeviceDto, UpdateDeviceDto } from './dto';
import { STATUS_LABELS } from './device-status';

@Controller('devices')
export class DevicesController {
  constructor(private devices: DevicesService, private catalog: CatalogService) {}

  @Get('catalog/manufacturers')
  @RequirePermissions('devices:read')
  manufacturers() {
    return { ...this.catalog.meta, manufacturers: this.catalog.manufacturers(), priority: PRIORITY_MODELS, statuses: STATUS_LABELS };
  }

  @Get('catalog/models')
  @RequirePermissions('devices:read')
  models(@Query('manufacturer') manufacturer: string) {
    if (!manufacturer) throw new BadRequestException('Indique el fabricante');
    return this.catalog.models(manufacturer);
  }

  @Get()
  @RequirePermissions('devices:read')
  list(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) {
    return this.devices.list(user, companyId);
  }

  @Get(':id')
  @RequirePermissions('devices:read')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.devices.findOwned(user, id).then(({ company: _c, ...d }) => d);
  }

  @Get(':id/diagnostics')
  @RequirePermissions('devices:read')
  diagnostics(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.devices.diagnostics(user, id);
  }

  @Get(':id/setup')
  @RequirePermissions('devices:read')
  setup(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.devices.setupSheet(user, id);
  }

  @Get(':id/route')
  @RequirePermissions('monitoring:read')
  route(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('from') from: string, @Query('to') to: string) {
    const f = new Date(from);
    const t = new Date(to);
    if (isNaN(f.getTime()) || isNaN(t.getTime())) throw new BadRequestException('Fechas inválidas (use ISO 8601 en UTC)');
    return this.devices.route(user, id, f, t);
  }

  @Post()
  @RequirePermissions('devices:write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDeviceDto) {
    return this.devices.create(user, dto);
  }

  @Post(':id/sync')
  @RequirePermissions('devices:write')
  sync(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.devices.retrySync(user, id);
  }

  @Patch(':id')
  @RequirePermissions('devices:write')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeviceDto) {
    return this.devices.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('devices:write')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.devices.remove(user, id);
  }
}
