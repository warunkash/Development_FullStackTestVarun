import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChargerEntity } from '../ocpp/entities/charger.entity';
import { SessionEntity } from '../ocpp/entities/session.entity';
import { MeterValueEntity } from '../ocpp/entities/meter-value.entity';

/**
 * ChargePointsModule provides additional charge point management capabilities
 * beyond the real-time OCPP protocol handling (e.g., querying history, reports).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ChargerEntity, SessionEntity, MeterValueEntity]),
  ],
  providers: [],
  exports: [],
})
export class ChargePointsModule {}
