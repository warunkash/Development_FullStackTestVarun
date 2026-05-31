import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  Max,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractType } from '../franchisee.entity';

export class CreateFranchiseeDto {
  @ApiProperty({ example: 'Telangana EV Solutions Pvt Ltd' })
  @IsString()
  @Length(2, 200)
  organizationName: string;

  @ApiProperty({ example: 'Suresh Reddy' })
  @IsString()
  @Length(2, 100)
  ownerName: string;

  @ApiProperty({ example: 'suresh@tevsolutions.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, { message: 'Invalid phone number' })
  phone: string;

  @ApiPropertyOptional({ example: '36AABCT1332L1ZD' })
  @IsOptional()
  @IsString()
  gstin?: string;

  @ApiPropertyOptional({ example: 'Plot 12, Jubilee Hills, Hyderabad' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Hyderabad' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Telangana' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '500033' })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9][0-9]{5}$/, { message: 'Invalid pincode' })
  pincode?: string;

  @ApiPropertyOptional({ enum: ContractType, default: ContractType.REVENUE_SHARE })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiPropertyOptional({ example: 25, description: 'Revenue share percentage for the franchisee (0-60)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  revenueSharePercent?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Monthly fixed fee in INR (for FIXED_FEE contract)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedMonthlyFee?: number;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @ApiPropertyOptional({ example: 'Suresh Reddy' })
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiPropertyOptional({ example: '1234567890123456' })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional({ example: 'SBIN0001234' })
  @IsOptional()
  @IsString()
  bankIfsc?: string;

  @ApiPropertyOptional({ example: 'State Bank of India' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
