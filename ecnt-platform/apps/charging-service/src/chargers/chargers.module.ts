import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChargerEntity } from './charger.entity';
import { ChargersService } from './chargers.service';
import { ChargersController } from './chargers.controller';
import { StationsModule } from '../stations/stations.module';

@Module({
  imports: [TypeOrmModule.forFeature([ChargerEntity]), StationsModule],
  controllers: [ChargersController],
  providers: [ChargersService],
  exports: [ChargersService],
})
export class ChargersModule {}
