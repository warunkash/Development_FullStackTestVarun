import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentType } from '../payment.entity';

export class CreatePaymentDto {
  @ApiProperty({ enum: PaymentType, description: 'Type of payment' })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiProperty({ example: 150.0, description: 'Amount in INR' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;

  @ApiProperty({ enum: PaymentMethod, description: 'Payment method to use' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ description: 'Associated charging session ID' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Payment description or notes' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Fleet account ID for corporate payments' })
  @IsOptional()
  @IsString()
  fleetAccountId?: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Razorpay order ID' })
  @IsString()
  razorpayOrderId: string;

  @ApiProperty({ description: 'Razorpay payment ID' })
  @IsString()
  razorpayPaymentId: string;

  @ApiProperty({ description: 'Razorpay signature for verification' })
  @IsString()
  razorpaySignature: string;
}

export class RefundDto {
  @ApiProperty({ description: 'Amount to refund in INR' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ description: 'Reason for refund' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateCorporatePaymentDto {
  @ApiProperty({ description: 'Fleet account ID' })
  @IsString()
  fleetAccountId: string;

  @ApiProperty({ description: 'Total billing amount in INR' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'List of session IDs to bill', type: [String] })
  @IsArray()
  @IsString({ each: true })
  sessionIds: string[];
}

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
