import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeartbeatScheduler } from './heartbeat.scheduler';
import { ChargerEntity } from '../ocpp/entities/charger.entity';
import { OcppModule } from '../ocpp/ocpp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChargerEntity]),
    OcppModule,
  ],
  providers: [HeartbeatScheduler],
})
export class HeartbeatModule {}
