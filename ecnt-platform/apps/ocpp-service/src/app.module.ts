import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { OcppModule } from './ocpp/ocpp.module';
import { ChargePointsModule } from './charge-points/charge-points.module';
import { HeartbeatModule } from './heartbeat/heartbeat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', 'password'),
        database: config.get('DB_NAME', 'ecnt_charging'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('DB_LOGGING', 'false') === 'true',
        extra: {
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
      inject: [ConfigService],
    }),

    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 50, // Many charge points can connect
    }),

    ScheduleModule.forRoot(),

    OcppModule,
    ChargePointsModule,
    HeartbeatModule,
  ],
})
export class AppModule {}
