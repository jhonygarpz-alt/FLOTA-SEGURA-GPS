import { Module } from '@nestjs/common';
import { PositionsController } from './positions.controller';
import { DevicesModule } from '../devices/devices.module';

@Module({ imports: [DevicesModule], controllers: [PositionsController] })
export class PositionsModule {}
