import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetVehicleEntity } from './fleet-vehicle.entity';
import { FleetBillingRecordEntity } from '../fleet-billing/fleet-billing-record.entity';
import { FleetVehiclesService } from './fleet-vehicles.service';
import { FleetVehiclesController } from './fleet-vehicles.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([FleetVehicleEntity, FleetBillingRecordEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [FleetVehiclesController],
  providers: [FleetVehiclesService],
  exports: [FleetVehiclesService],
})
export class FleetVehiclesModule {}
