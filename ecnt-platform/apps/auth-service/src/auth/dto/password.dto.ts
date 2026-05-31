import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    description: 'New password with uppercase, lowercase, number and special character',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'Registered email or phone number',
  })
  @IsString()
  @IsNotEmpty()
  emailOrPhone: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'Registered email or phone number',
  })
  @IsString()
  @IsNotEmpty()
  emailOrPhone: string;

  @ApiProperty({ example: '123456', description: 'OTP received for password reset' })
  @IsString()
  @Length(6, 8)
  otp: string;

  @ApiProperty({
    description: 'New password',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  newPassword: string;
}
