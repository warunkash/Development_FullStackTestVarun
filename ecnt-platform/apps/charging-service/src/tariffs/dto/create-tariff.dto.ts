import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsUUID,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TariffType, TariffApplicability } from '../tariff.entity';

export class TariffRuleDto {
  @ApiProperty({ example: 9, description: 'Start hour (0-23)' })
  @IsNumber()
  @Min(0)
  @Max(23)
  startHour: number;

  @ApiProperty({ example: 18, description: 'End hour (0-23)' })
  @IsNumber()
  @Min(0)
  @Max(23)
  endHour: number;

  @ApiPropertyOptional({ type: [Number], example: [1, 2, 3, 4, 5], description: '0=Sun...6=Sat' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  daysOfWeek?: number[];

  @ApiProperty({ example: 12.5, description: 'Rate in INR per kWh' })
  @IsNumber()
  @Min(0)
  ratePerKwh: number;

  @ApiPropertyOptional({ example: 1.0, description: 'Rate in INR per minute (for time-based)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ratePerMinute?: number;

  @ApiPropertyOptional({ example: 'Peak Hours' })
  @IsOptional()
  @IsString()
  label?: string;
}

export class CreateTariffDto {
  @ApiProperty({ example: 'Standard AC Tariff' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TariffType })
  @IsEnum(TariffType)
  type: TariffType;

  @ApiPropertyOptional({ enum: TariffApplicability })
  @IsOptional()
  @IsEnum(TariffApplicability)
  applicability?: TariffApplicability;

  @ApiProperty({ example: 10.0, description: 'Base rate INR per kWh' })
  @IsNumber()
  @Min(0)
  baseRatePerKwh: number;

  @ApiPropertyOptional({ example: 0.5, description: 'Base rate INR per minute' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseRatePerMinute?: number;

  @ApiPropertyOptional({ example: 20.0, description: 'Fixed session start fee INR' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionFeeInr?: number;

  @ApiPropertyOptional({ example: 2.0, description: 'Idling fee per minute after session ends' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  idlingFeePerMinute?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  stationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  chargerId?: string;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30)
  taxPercentage?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  taxInclusive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validFrom?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validUntil?: Date;

  @ApiPropertyOptional({ type: [TariffRuleDto], description: 'Time-of-day pricing rules' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TariffRuleDto)
  rules?: TariffRuleDto[];

  @ApiPropertyOptional({ example: 100, description: 'Priority (higher wins)' })
  @IsOptional()
  @IsNumber()
  priority?: number;
}
