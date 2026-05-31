import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'Email address or Indian phone number (+91XXXXXXXXXX)',
  })
  @IsString()
  @IsNotEmpty()
  emailOrPhone: string;

  @ApiProperty({ example: 'MySecurePass@123', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    example: '123456',
    description: '6-digit MFA TOTP token (required if MFA is enabled)',
  })
  @IsOptional()
  @IsString()
  mfaToken?: string;
}
