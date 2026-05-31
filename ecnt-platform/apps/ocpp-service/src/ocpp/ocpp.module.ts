import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OcppGateway } from './ocpp.gateway';
import { OcppMessageHandler } from './ocpp-message.handler';
import { OcppCommandsService } from './ocpp-commands.service';
import { OcppController } from './ocpp.controller';
import { ChargerEntity } from './entities/charger.entity';
import { SessionEntity } from './entities/session.entity';
import { MeterValueEntity } from './entities/meter-value.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChargerEntity, SessionEntity, MeterValueEntity]),
  ],
  controllers: [OcppController],
  providers: [OcppGateway, OcppMessageHandler, OcppCommandsService],
  exports: [OcppGateway, OcppCommandsService],
})
export class OcppModule {}
