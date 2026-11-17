import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { CatalogService } from './catalog.service';

@Module({ controllers: [DevicesController], providers: [DevicesService, CatalogService], exports: [DevicesService] })
export class DevicesModule {}
