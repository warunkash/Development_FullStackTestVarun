import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateFleetAccountDto } from './create-fleet-account.dto';

export class UpdateFleetAccountDto extends PartialType(CreateFleetAccountDto) {}

export class SuspendFleetDto {
  @ApiPropertyOptional({ example: 'Payment overdue for 60 days' })
  @IsOptional()
  @IsString()
  reason?: string;
}
