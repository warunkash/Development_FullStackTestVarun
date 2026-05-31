import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetAccountsController } from './fleet-accounts.controller';
import { FleetAccountsService } from './fleet-accounts.service';
import { FleetAccountEntity } from './fleet-account.entity';
import { FleetVehicleEntity } from '../fleet-vehicles/fleet-vehicle.entity';
import { FleetDriverEntity } from '../fleet-drivers/fleet-driver.entity';
import { FleetBillingRecordEntity } from '../fleet-billing/fleet-billing-record.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FleetAccountEntity,
      FleetVehicleEntity,
      FleetDriverEntity,
      FleetBillingRecordEntity,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [FleetAccountsController],
  providers: [FleetAccountsService],
  exports: [FleetAccountsService],
})
export class FleetAccountsModule {}
