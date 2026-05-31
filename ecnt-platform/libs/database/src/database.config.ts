import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as entities from './entities';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DATABASE_HOST', 'localhost'),
  port: configService.get<number>('DATABASE_PORT', 5432),
  database: configService.get<string>('DATABASE_NAME', 'ecnt_db'),
  username: configService.get<string>('DATABASE_USER', 'ecnt_user'),
  password: configService.get<string>('DATABASE_PASSWORD'),
  entities: Object.values(entities).filter(
    (e): e is new () => object =>
      typeof e === 'function' && e.prototype !== undefined,
  ),
  migrations: ['dist/libs/database/src/migrations/*.js'],
  migrationsRun: false,
  synchronize: configService.get<string>('NODE_ENV') === 'development',
  logging: configService.get<string>('DATABASE_LOGGING', 'false') === 'true',
  ssl:
    configService.get<string>('DATABASE_SSL', 'false') === 'true'
      ? { rejectUnauthorized: false }
      : false,
  extra: {
    max: configService.get<number>('DATABASE_POOL_SIZE', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  autoLoadEntities: true,
});
