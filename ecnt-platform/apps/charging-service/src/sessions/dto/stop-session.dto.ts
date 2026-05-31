import { IsEnum, IsOptional, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StopReason } from '../session.entity';

export class StopSessionDto {
  @ApiPropertyOptional({ enum: StopReason, default: StopReason.LOCAL })
  @IsOptional()
  @IsEnum(StopReason)
  reason?: StopReason;

  @ApiPropertyOptional({ description: 'Final meter reading in Wh' })
  @IsOptional()
  @IsNumber()
  meterStop?: number;
}
