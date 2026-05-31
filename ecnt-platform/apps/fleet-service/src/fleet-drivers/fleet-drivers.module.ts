import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetDriverEntity } from './fleet-driver.entity';
import { FleetBillingRecordEntity } from '../fleet-billing/fleet-billing-record.entity';
import { FleetDriversService } from './fleet-drivers.service';
import { FleetDriversController } from './fleet-drivers.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([FleetDriverEntity, FleetBillingRecordEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [FleetDriversController],
  providers: [FleetDriversService],
  exports: [FleetDriversService],
})
export class FleetDriversModule {}
