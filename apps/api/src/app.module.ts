import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { OperatorsModule } from './operators/operators.module';
import { DevicesModule } from './devices/devices.module';
import { TraccarModule } from './traccar/traccar.module';
import { RealtimeModule } from './realtime/realtime.module';
import { PositionsModule } from './positions/positions.module';
import { DemoModule } from './demo/demo.module';
import { HealthController } from './health/health.controller';
import { AuthGuard, PermissionsGuard } from './common/guards';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    RealtimeModule,
    TraccarModule,
    DemoModule,
    CompaniesModule,
    UsersModule,
    VehiclesModule,
    OperatorsModule,
    DevicesModule,
    PositionsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
