import { IsNumber, Min, Max, IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class TopUpDto {
  @ApiProperty({
    example: 500,
    description: 'Amount to add to wallet in INR (min: 10, max: 50000)',
    minimum: 10,
    maximum: 50000,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(10)
  @Max(50000)
  amount: number;

  @ApiProperty({ description: 'Payment gateway transaction ID' })
  @IsString()
  paymentId: string;

  @ApiPropertyOptional({ description: 'Payment gateway (razorpay, stripe, etc.)' })
  @IsOptional()
  @IsString()
  gateway?: string;
}

export class TransferDto {
  @ApiProperty({ description: 'Target user ID to transfer funds to' })
  @IsUUID()
  toUserId: string;

  @ApiProperty({
    example: 100,
    description: 'Amount to transfer in INR',
    minimum: 1,
    maximum: 10000,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10000)
  amount: number;
}

export class WalletTransactionFilterDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by transaction type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Start date for filtering (ISO 8601)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for filtering (ISO 8601)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
