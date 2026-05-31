import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetPolicyEntity } from './fleet-policy.entity';
import { FleetVehicleEntity } from '../fleet-vehicles/fleet-vehicle.entity';
import { FleetBillingRecordEntity } from '../fleet-billing/fleet-billing-record.entity';
import { FleetPoliciesService } from './fleet-policies.service';
import { FleetPoliciesController } from './fleet-policies.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FleetPolicyEntity,
      FleetVehicleEntity,
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
  controllers: [FleetPoliciesController],
  providers: [FleetPoliciesService],
  exports: [FleetPoliciesService],
})
export class FleetPoliciesModule {}
