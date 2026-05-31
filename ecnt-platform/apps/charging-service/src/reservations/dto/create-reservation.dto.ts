import {
  IsUUID,
  IsString,
  IsOptional,
  IsDate,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReservationDto {
  @ApiProperty({ description: 'Station UUID' })
  @IsUUID()
  stationId: string;

  @ApiProperty({ description: 'Charger UUID' })
  @IsUUID()
  chargerId: string;

  @ApiProperty({ example: '1', description: 'Connector number' })
  @IsString()
  connectorId: string;

  @ApiPropertyOptional({ description: 'Vehicle UUID for this reservation' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiProperty({ description: 'Reservation start time (ISO 8601)' })
  @Type(() => Date)
  @IsDate()
  startTime: Date;

  @ApiProperty({ description: 'Reservation end time (ISO 8601)' })
  @Type(() => Date)
  @IsDate()
  endTime: Date;

  // Injected from auth middleware
  userId?: string;
}
