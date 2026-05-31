import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetAccountsModule } from './fleet-accounts/fleet-accounts.module';
import { FleetVehiclesModule } from './fleet-vehicles/fleet-vehicles.module';
import { FleetDriversModule } from './fleet-drivers/fleet-drivers.module';
import { FleetBillingModule } from './fleet-billing/fleet-billing.module';
import { FleetPoliciesModule } from './fleet-policies/fleet-policies.module';
import { FleetAccountEntity } from './fleet-accounts/fleet-account.entity';
import { FleetVehicleEntity } from './fleet-vehicles/fleet-vehicle.entity';
import { FleetDriverEntity } from './fleet-drivers/fleet-driver.entity';
import { FleetPolicyEntity } from './fleet-policies/fleet-policy.entity';
import { FleetBillingRecordEntity } from './fleet-billing/fleet-billing-record.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'ecnt'),
        password: config.get('DB_PASSWORD', 'ecnt_pass'),
        database: config.get('DB_NAME', 'ecnt_fleet'),
        entities: [
          FleetAccountEntity,
          FleetVehicleEntity,
          FleetDriverEntity,
          FleetPolicyEntity,
          FleetBillingRecordEntity,
        ],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    FleetAccountsModule,
    FleetVehiclesModule,
    FleetDriversModule,
    FleetBillingModule,
    FleetPoliciesModule,
  ],
})
export class AppModule {}
