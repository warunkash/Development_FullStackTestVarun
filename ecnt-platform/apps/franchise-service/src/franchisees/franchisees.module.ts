import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FranchiseeEntity } from './franchisee.entity';
import { FranchiseePaymentEntity } from './franchisee-payment.entity';
import { FranchiseeRevenueRecordEntity } from './franchisee-revenue-record.entity';
import { FranchiseesService } from './franchisees.service';
import { FranchiseesController } from './franchisees.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FranchiseeEntity,
      FranchiseePaymentEntity,
      FranchiseeRevenueRecordEntity,
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
  controllers: [FranchiseesController],
  providers: [FranchiseesService],
  exports: [FranchiseesService],
})
export class FranchiseesModule {}
