import {
  IsUUID,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartSessionDto {
  @ApiProperty({ description: 'Charger UUID' })
  @IsUUID()
  chargerId: string;

  @ApiProperty({ example: '1', description: 'Connector number (1 or 2)' })
  @IsString()
  connectorId: string;

  @ApiPropertyOptional({ description: 'Vehicle UUID for this session' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Tariff UUID to apply' })
  @IsOptional()
  @IsUUID()
  tariffId?: string;

  @ApiPropertyOptional({ description: 'Reservation UUID if applicable' })
  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @ApiPropertyOptional({ description: 'RFID tag for authentication' })
  @IsOptional()
  @IsString()
  rfidTag?: string;

  // Injected from auth middleware
  userId?: string;
}
