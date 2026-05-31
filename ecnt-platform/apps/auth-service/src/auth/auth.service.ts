import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { UsersService } from '../users/users.service';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OtpLoginDto, SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MfaSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existingEmail = await this.usersService.findByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    const existingPhone = await this.usersService.findByPhone(dto.phone);
    if (existingPhone) {
      throw new ConflictException('Phone number already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      ...dto,
      passwordHash,
    });

    // Send email verification OTP
    await this.otpService.sendEmailOtp(user.email, 'EMAIL_VERIFY');

    // Send welcome event
    this.eventEmitter.emit('user.registered', {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
    });

    this.logger.log(`User registered: ${user.email}`);
    return this.generateTokens(user.id, user.roles);
  }

  async login(dto: LoginDto): Promise<AuthTokens & { mfaRequired?: boolean }> {
    const user = await this.validateUser(dto.emailOrPhone, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated. Please contact support.');
    }

    if (user.mfaEnabled) {
      if (!dto.mfaToken) {
        return { accessToken: '', refreshToken: '', expiresIn: 0, mfaRequired: true };
      }
      const mfaValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: dto.mfaToken,
        window: 1,
      });
      if (!mfaValid) {
        throw new UnauthorizedException('Invalid MFA token');
      }
    }

    // Update last login
    await this.usersService.update(user.id, { lastLoginAt: new Date() });

    this.eventEmitter.emit('user.loggedIn', { userId: user.id, email: user.email });
    this.logger.log(`User logged in: ${user.email}`);
    return this.generateTokens(user.id, user.roles);
  }

  async loginWithOtp(dto: OtpLoginDto): Promise<AuthTokens> {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) {
      throw new NotFoundException('No account found with this phone number');
    }

    const isValid = await this.otpService.verifyOtp(dto.phone, dto.otp, 'PHONE_LOGIN');
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    await this.usersService.update(user.id, { lastLoginAt: new Date() });
    return this.generateTokens(user.id, user.roles);
  }

  async sendOtp(dto: SendOtpDto): Promise<{ message: string; expiresIn: number }> {
    const { target, purpose } = dto;
    const isPhone = /^\+91[6-9]\d{9}$/.test(target);

    if (isPhone) {
      await this.otpService.sendSmsOtp(target, purpose);
    } else {
      await this.otpService.sendEmailOtp(target, purpose);
    }

    return {
      message: `OTP sent to ${isPhone ? 'phone' : 'email'}`,
      expiresIn: 300,
    };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
  ): Promise<{ verified: boolean; message: string }> {
    const isValid = await this.otpService.verifyOtp(
      dto.target,
      dto.otp,
      dto.purpose,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const isPhone = /^\+91[6-9]\d{9}$/.test(dto.target);
    if (isPhone) {
      const user = await this.usersService.findByPhone(dto.target);
      if (user) {
        await this.usersService.update(user.id, { phoneVerified: true });
      }
    } else {
      const user = await this.usersService.findByEmail(dto.target);
      if (user) {
        await this.usersService.update(user.id, { emailVerified: true });
      }
    }

    return { verified: true, message: 'OTP verified successfully' };
  }

  async refreshToken(
    token: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const refreshToken = await this.tokenService.findRefreshToken(token);

    if (!refreshToken || refreshToken.isRevoked) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > refreshToken.expiresAt) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.usersService.findById(refreshToken.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      type: 'access',
    });

    const expiresIn = this.configService.get<number>('JWT_ACCESS_EXPIRY_SECONDS', 900);
    return { accessToken, expiresIn };
  }

  async logout(userId: string, token: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(token);
    this.logger.log(`User logged out: ${userId}`);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokenService.revokeAllUserTokens(userId);
    this.logger.log(`All sessions revoked for user: ${userId}`);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must differ from current password');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersService.updatePassword(userId, newHash);

    // Revoke all tokens on password change
    await this.tokenService.revokeAllUserTokens(userId);

    this.eventEmitter.emit('user.passwordChanged', { userId, email: user.email });
    return { message: 'Password changed successfully' };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const isPhone = /^\+91[6-9]\d{9}$/.test(dto.emailOrPhone);
    let user: any;

    if (isPhone) {
      user = await this.usersService.findByPhone(dto.emailOrPhone);
    } else {
      user = await this.usersService.findByEmail(dto.emailOrPhone);
    }

    // Always return success to prevent user enumeration
    if (!user) {
      return { message: 'If an account exists, a reset OTP has been sent' };
    }

    if (isPhone) {
      await this.otpService.sendSmsOtp(dto.emailOrPhone, 'PASSWORD_RESET');
    } else {
      await this.otpService.sendEmailOtp(dto.emailOrPhone, 'PASSWORD_RESET');
    }

    return { message: 'If an account exists, a reset OTP has been sent' };
  }

  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const isValid = await this.otpService.verifyOtp(
      dto.emailOrPhone,
      dto.otp,
      'PASSWORD_RESET',
    );

    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const isPhone = /^\+91[6-9]\d{9}$/.test(dto.emailOrPhone);
    let user: any;

    if (isPhone) {
      user = await this.usersService.findByPhone(dto.emailOrPhone);
    } else {
      user = await this.usersService.findByEmail(dto.emailOrPhone);
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersService.updatePassword(user.id, newHash);
    await this.tokenService.revokeAllUserTokens(user.id);

    return { message: 'Password reset successfully' };
  }

  async enableMfa(userId: string): Promise<MfaSetupResult> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.mfaEnabled) {
      throw new ConflictException('MFA is already enabled');
    }

    const secret = speakeasy.generateSecret({
      name: `ECNT:${user.email}`,
      issuer: 'ECNT Platform',
      length: 20,
    });

    await this.usersService.update(userId, { mfaSecret: secret.base32, mfaEnabled: false });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    const backupCodes = this.generateBackupCodes();

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  async verifyMfa(
    userId: string,
    token: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.mfaSecret) {
      throw new BadRequestException('MFA setup not initiated');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA token');
    }

    await this.usersService.update(userId, { mfaEnabled: true });
    return { message: 'MFA enabled successfully' };
  }

  async disableMfa(
    userId: string,
    token: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA token');
    }

    await this.usersService.update(userId, { mfaEnabled: false, mfaSecret: null });
    return { message: 'MFA disabled successfully' };
  }

  async validateUser(emailOrPhone: string, password: string): Promise<any> {
    let user: any;
    const isPhone = /^\+91[6-9]\d{9}$/.test(emailOrPhone);

    if (isPhone) {
      user = await this.usersService.findByPhone(emailOrPhone);
    } else {
      user = await this.usersService.findByEmail(emailOrPhone);
    }

    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return null;

    return user;
  }

  async generateTokens(userId: string, roles: string[]): Promise<AuthTokens> {
    const user = await this.usersService.findById(userId);

    const payload = {
      sub: userId,
      email: user.email,
      roles,
      type: 'access',
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.configService.get<number>('JWT_ACCESS_EXPIRY_SECONDS', 900);

    const refreshTokenValue = await this.tokenService.createRefreshToken(userId);

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn,
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (payload.type !== 'email_verify') {
      throw new BadRequestException('Invalid token type');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.emailVerified) {
      return { message: 'Email already verified' };
    }

    await this.usersService.update(payload.sub, { emailVerified: true });
    return { message: 'Email verified successfully' };
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase(),
    );
  }
}
