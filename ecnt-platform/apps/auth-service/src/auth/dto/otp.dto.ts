import { IsString, IsNotEmpty, Matches, IsEnum, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum OtpPurpose {
  PHONE_LOGIN = 'PHONE_LOGIN',
  PHONE_VERIFY = 'PHONE_VERIFY',
  EMAIL_VERIFY = 'EMAIL_VERIFY',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export class SendOtpDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'Target phone number or email address',
  })
  @IsString()
  @IsNotEmpty()
  target: string;

  @ApiProperty({
    enum: OtpPurpose,
    example: OtpPurpose.PHONE_LOGIN,
    description: 'Purpose of the OTP',
  })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}

export class VerifyOtpDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'Phone number or email address the OTP was sent to',
  })
  @IsString()
  @IsNotEmpty()
  target: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @Length(4, 8)
  otp: string;

  @ApiProperty({
    enum: OtpPurpose,
    example: OtpPurpose.PHONE_LOGIN,
    description: 'Purpose of the OTP',
  })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}

export class OtpLoginDto {
  @ApiProperty({ example: '+919876543210', description: 'Indian phone number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Invalid Indian phone number' })
  phone: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP received on phone' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp: string;
}
