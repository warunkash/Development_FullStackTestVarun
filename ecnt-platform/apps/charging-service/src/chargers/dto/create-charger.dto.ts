import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChargerType, OcppVersion } from '../charger.entity';

export class CreateChargerDto {
  @ApiProperty({ description: 'Station UUID this charger belongs to' })
  @IsUUID()
  stationId: string;

  @ApiProperty({ example: 'SN-ECNT-2024-001' })
  @IsString()
  @MaxLength(100)
  serialNumber: string;

  @ApiProperty({ example: 'EO Basic Home' })
  @IsString()
  @MaxLength(100)
  model: string;

  @ApiProperty({ example: 'EVBox' })
  @IsString()
  @MaxLength(100)
  manufacturer: string;

  @ApiProperty({ enum: ChargerType })
  @IsEnum(ChargerType)
  type: ChargerType;

  @ApiProperty({ example: 7.4, description: 'Maximum power in kW' })
  @IsNumber()
  @Min(1)
  @Max(350)
  maxPowerKw: number;

  @ApiProperty({ example: 230, description: 'Voltage in Volts' })
  @IsNumber()
  @Min(100)
  @Max(1000)
  voltage: number;

  @ApiProperty({ example: 32, description: 'Amperage in Amps' })
  @IsNumber()
  @Min(8)
  @Max(630)
  amperage: number;

  @ApiProperty({ example: 'ECNT-KOR-001-CP1', description: 'Unique OCPP Charge Point ID' })
  @IsString()
  @MaxLength(100)
  ocppChargePointId: string;

  @ApiPropertyOptional({ enum: OcppVersion, default: OcppVersion.V16 })
  @IsOptional()
  @IsEnum(OcppVersion)
  ocppVersion?: OcppVersion;

  @ApiPropertyOptional({ example: 2, description: 'Number of connectors (1 or 2)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  numberOfConnectors?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateChargerDto {
  @ApiPropertyOptional({ example: 'EO Basic Home' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 'EVBox' })
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firmwareVersion?: string;
}

export class UpdateChargerStatusDto {
  @ApiProperty({ description: 'New status for charger or connector' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ example: 1, description: 'Connector ID (1-indexed), omit for whole charger' })
  @IsOptional()
  @IsNumber()
  connectorId?: number;
}
