import { IsOptional, IsDateString, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum AnalyticsPeriod {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_3_MONTHS = 'last_3_months',
  LAST_YEAR = 'last_year',
  CUSTOM = 'custom',
}

export class AnalyticsFilterDto {
  @ApiPropertyOptional({
    enum: AnalyticsPeriod,
    default: AnalyticsPeriod.LAST_30_DAYS,
    description: 'Preset period for analytics query',
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.LAST_30_DAYS;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Start date for custom period (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-01-31', description: 'End date for custom period (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by specific station ID' })
  @IsOptional()
  @IsString()
  stationId?: string;

  @ApiPropertyOptional({ description: 'Filter by specific charger ID' })
  @IsOptional()
  @IsString()
  chargerId?: string;

  @ApiPropertyOptional({ description: 'Filter by franchisee ID' })
  @IsOptional()
  @IsString()
  franchiseeId?: string;

  @ApiPropertyOptional({ description: 'Group results by: day, week, month', default: 'day' })
  @IsOptional()
  @IsString()
  groupBy?: 'day' | 'week' | 'month' = 'day';
}
