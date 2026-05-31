import { IsEnum, IsOptional, IsString, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StationStatus, StationAmenity } from '../station.entity';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class StationFilterDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Karnataka' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ enum: StationStatus })
  @IsOptional()
  @IsEnum(StationStatus)
  status?: StationStatus;

  @ApiPropertyOptional({ type: [String], enum: StationAmenity })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  amenities?: StationAmenity[];

  @ApiPropertyOptional({ description: 'Filter stations with at least one available charger' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasAvailable?: boolean;

  @ApiPropertyOptional({ example: 'koramangala' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'DC' })
  @IsOptional()
  @IsString()
  chargerType?: string;

  @ApiPropertyOptional({ example: '560034' })
  @IsOptional()
  @IsString()
  pincode?: string;
}
