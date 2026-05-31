import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'john@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ example: '+919876543210', description: 'Indian mobile number' })
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Invalid Indian phone number. Format: +91XXXXXXXXXX' })
  phone: string;

  @ApiProperty({
    minLength: 8,
    description: 'Password with uppercase, lowercase, number and special character',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
  })
  password: string;

  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiPropertyOptional({ description: 'Referral code from existing user' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;
}
