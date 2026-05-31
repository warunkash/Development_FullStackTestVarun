import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetBillingRecordEntity } from './fleet-billing-record.entity';
import { FleetBillingService } from './fleet-billing.service';
import { FleetBillingController } from './fleet-billing.controller';
import { FleetAccountEntity } from '../fleet-accounts/fleet-account.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([FleetBillingRecordEntity, FleetAccountEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [FleetBillingController],
  providers: [FleetBillingService],
  exports: [FleetBillingService],
})
export class FleetBillingModule {}
