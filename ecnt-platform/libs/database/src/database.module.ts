import { Module, DynamicModule, Global } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getDatabaseConfig } from './database.config';

/**
 * Global database module that configures TypeORM with environment-based settings.
 * Import this in the AppModule of each microservice.
 */
@Global()
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService): TypeOrmModuleOptions =>
            getDatabaseConfig(configService),
        }),
      ],
      exports: [TypeOrmModule],
    };
  }
}
