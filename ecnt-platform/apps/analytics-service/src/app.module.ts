import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsModule } from './analytics/analytics.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        // Analytics reads from the primary ECNT database (read replica preferred)
        database: configService.get('DB_NAME', 'ecnt_main'),
        entities: [],
        synchronize: false, // Analytics service is read-only on main DB
        logging: configService.get('DB_LOGGING', 'false') === 'true',
        ssl:
          configService.get('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
        extra: {
          connectionTimeoutMillis: 10000,
          idleTimeoutMillis: 30000,
          max: 10,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    AnalyticsModule,
    ReportsModule,
    DashboardModule,
  ],
})
export class AppModule {}
