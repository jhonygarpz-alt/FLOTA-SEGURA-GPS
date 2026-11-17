import { Global, Module } from '@nestjs/common';
import { TraccarClient } from './traccar.client';
import { TraccarSocket } from './traccar.socket';
import { DeviceRegistry } from './device-registry';

@Global()
@Module({ providers: [TraccarClient, TraccarSocket, DeviceRegistry], exports: [TraccarClient, TraccarSocket, DeviceRegistry] })
export class TraccarModule {}
