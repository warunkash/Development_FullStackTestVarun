import {
  IsString,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsOptional,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVehicleDto {
  @ApiProperty({ description: 'Vehicle model ID (UUID)' })
  @IsUUID()
  vehicleModelId: string;

  @ApiProperty({
    example: 'TS09AB1234',
    description: 'Indian vehicle registration number',
  })
  @IsString()
  @Matches(/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/, {
    message: 'Invalid registration number format. Example: TS09AB1234',
  })
  registrationNumber: string;

  @ApiPropertyOptional({ description: 'Vehicle Identification Number (VIN)' })
  @IsOptional()
  @IsString()
  @MaxLength(17)
  vin?: string;

  @ApiPropertyOptional({ example: 'Pearl White' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @ApiPropertyOptional({ example: 2024, minimum: 2010, maximum: 2030 })
  @IsOptional()
  @IsInt()
  @Min(2010)
  @Max(2030)
  year?: number;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @ApiPropertyOptional({ minimum: 2010, maximum: 2030 })
  @IsOptional()
  @IsInt()
  @Min(2010)
  @Max(2030)
  year?: number;

  @ApiPropertyOptional({ description: 'Set as primary vehicle' })
  @IsOptional()
  isPrimary?: boolean;
}

export class AddVehicleModelDto {
  @ApiProperty({ example: 'Tata' })
  @IsString()
  brand: string;

  @ApiProperty({ example: 'Nexon EV' })
  @IsString()
  model: string;

  @ApiPropertyOptional({ example: 'Max Long Range' })
  @IsOptional()
  @IsString()
  variant?: string;

  @ApiProperty({ example: 40.5, description: 'Battery capacity in kWh' })
  batteryCapacityKwh: number;

  @ApiPropertyOptional({ example: 465, description: 'Claimed range in km' })
  @IsOptional()
  @IsInt()
  rangeKm?: number;

  @ApiProperty({ example: ['CCS2', 'Type2'], description: 'Supported connector types' })
  connectorTypes: string[];

  @ApiPropertyOptional({ example: 7.2 })
  @IsOptional()
  maxAcChargingKw?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  maxDcChargingKw?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class VehicleFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  connectorType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
