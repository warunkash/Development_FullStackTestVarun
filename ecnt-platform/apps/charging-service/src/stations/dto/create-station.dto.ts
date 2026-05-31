import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsPhoneNumber,
  IsUUID,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StationAmenity, StationStatus } from '../station.entity';

export class OperatingHoursSlotDto {
  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Time must be in HH:MM format' })
  open: string;

  @ApiProperty({ example: '21:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Time must be in HH:MM format' })
  close: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  closed: boolean;
}

export class CreateStationDto {
  @ApiProperty({ example: 'ECNT Hub Koramangala' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'ECNT-KOR-001' })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ example: 'Premium charging hub with lounge' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '100, 12th Main Road, Koramangala' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'Bengaluru' })
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'Karnataka' })
  @IsString()
  @MaxLength(100)
  state: string;

  @ApiProperty({ example: '560034' })
  @IsString()
  @MaxLength(10)
  pincode: string;

  @ApiProperty({ example: 12.9352 })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 77.6245 })
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ type: [String], enum: StationAmenity })
  @IsOptional()
  @IsArray()
  @IsEnum(StationAmenity, { each: true })
  amenities?: StationAmenity[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is24Hours?: boolean;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Time must be in HH:MM format' })
  openingTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Time must be in HH:MM format' })
  closingTime?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  franchiseeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export { StationStatus, StationAmenity };
