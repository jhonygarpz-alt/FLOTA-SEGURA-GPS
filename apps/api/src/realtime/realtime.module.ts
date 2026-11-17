import { Global, Module } from '@nestjs/common';
import { RealtimeHub } from './realtime.hub';
import { RealtimeGateway } from './realtime.gateway';

@Global()
@Module({ providers: [RealtimeHub, RealtimeGateway], exports: [RealtimeHub] })
export class RealtimeModule {}
