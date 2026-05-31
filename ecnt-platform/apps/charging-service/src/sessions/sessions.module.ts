import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionEntity, MeterValueEntity } from './session.entity';
import { ChargerEntity } from '../chargers/charger.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { TariffsModule } from '../tariffs/tariffs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionEntity, MeterValueEntity, ChargerEntity]),
    TariffsModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
