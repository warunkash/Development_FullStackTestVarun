import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  Max,
  IsPhoneNumber,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FleetType, BillingCycle } from '../fleet-account.entity';

export class CreateFleetAccountDto {
  @ApiProperty({ example: 'Hyderabad Logistics Pvt Ltd' })
  @IsString()
  @Length(2, 200)
  organizationName: string;

  @ApiProperty({ enum: FleetType, example: FleetType.DELIVERY })
  @IsEnum(FleetType)
  fleetType: FleetType;

  @ApiPropertyOptional({ example: '29AABCT1332L1ZD' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Invalid GSTIN format',
  })
  gstin?: string;

  @ApiProperty({ example: 'Rajesh Kumar' })
  @IsString()
  @Length(2, 100)
  contactPersonName: string;

  @ApiProperty({ example: 'rajesh@hyderabadlogistics.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, { message: 'Invalid phone number' })
  phone: string;

  @ApiPropertyOptional({ example: 'Plot 45, HITEC City, Hyderabad' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: BillingCycle, default: BillingCycle.MONTHLY })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({ example: 50000, description: 'Credit limit in INR' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @ApiPropertyOptional({ example: 10, description: 'Discount percentage 0-50' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  discountPercent?: number;

  @ApiPropertyOptional({ example: 'Special contract terms...' })
  @IsOptional()
  @IsString()
  notes?: string;
}
