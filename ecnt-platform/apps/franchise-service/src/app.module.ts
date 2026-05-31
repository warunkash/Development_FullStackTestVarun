import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FranchiseesModule } from './franchisees/franchisees.module';
import { FranchiseeEntity } from './franchisees/franchisee.entity';
import { FranchiseePaymentEntity } from './franchisees/franchisee-payment.entity';
import { FranchiseeRevenueRecordEntity } from './franchisees/franchisee-revenue-record.entity';

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
        database: config.get('DB_NAME', 'ecnt_franchise'),
        entities: [
          FranchiseeEntity,
          FranchiseePaymentEntity,
          FranchiseeRevenueRecordEntity,
        ],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    FranchiseesModule,
  ],
})
export class AppModule {}
