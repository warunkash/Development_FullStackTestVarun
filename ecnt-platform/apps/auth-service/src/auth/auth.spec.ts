import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let tokenService: jest.Mocked<TokenService>;
  let otpService: jest.Mocked<OtpService>;
  let configService: jest.Mocked<ConfigService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'john@example.com',
    phone: '+919876543210',
    passwordHash: '$2b$12$hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    roles: ['user'],
    isActive: true,
    emailVerified: false,
    phoneVerified: false,
    mfaEnabled: false,
    mfaSecret: null,
    referralCode: 'JOH123ABC',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByPhone: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updatePassword: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-access-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            createRefreshToken: jest.fn().mockResolvedValue('mock-refresh-token'),
            findRefreshToken: jest.fn(),
            revokeRefreshToken: jest.fn(),
            revokeAllUserTokens: jest.fn(),
          },
        },
        {
          provide: OtpService,
          useValue: {
            sendSmsOtp: jest.fn(),
            sendEmailOtp: jest.fn(),
            verifyOtp: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal: any) => defaultVal),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    tokenService = module.get(TokenService);
    otpService = module.get(OtpService);
    configService = module.get(ConfigService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('register', () => {
    const registerDto = {
      email: 'john@example.com',
      phone: '+919876543210',
      password: 'SecurePass@123',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should register a new user successfully', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.findByPhone.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser as any);
      usersService.findById.mockResolvedValue(mockUser as any);
      otpService.sendEmailOtp.mockResolvedValue();

      const result = await authService.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(usersService.create).toHaveBeenCalledTimes(1);
      expect(otpService.sendEmailOtp).toHaveBeenCalledWith(registerDto.email, 'EMAIL_VERIFY');
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.registered', expect.any(Object));
    });

    it('should throw ConflictException when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(authService.register(registerDto)).rejects.toThrow('Email already registered');
    });

    it('should throw ConflictException when phone already exists', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.findByPhone.mockResolvedValue(mockUser as any);

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(authService.register(registerDto)).rejects.toThrow('Phone number already registered');
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      jest.spyOn(authService, 'validateUser').mockResolvedValue(mockUser);
      usersService.update.mockResolvedValue(mockUser as any);
      usersService.findById.mockResolvedValue(mockUser as any);

      const result = await authService.login({
        emailOrPhone: 'john@example.com',
        password: 'SecurePass@123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException with invalid credentials', async () => {
      jest.spyOn(authService, 'validateUser').mockResolvedValue(null);

      await expect(
        authService.login({ emailOrPhone: 'wrong@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      jest.spyOn(authService, 'validateUser').mockResolvedValue(inactiveUser);

      await expect(
        authService.login({ emailOrPhone: 'john@example.com', password: 'SecurePass@123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should indicate MFA required when enabled but no token provided', async () => {
      const mfaUser = { ...mockUser, mfaEnabled: true, mfaSecret: 'MFASECRET' };
      jest.spyOn(authService, 'validateUser').mockResolvedValue(mfaUser);

      const result = await authService.login({
        emailOrPhone: 'john@example.com',
        password: 'SecurePass@123',
      });

      expect(result.mfaRequired).toBe(true);
    });
  });

  describe('verifyOtp', () => {
    it('should verify phone OTP and mark phone as verified', async () => {
      otpService.verifyOtp.mockResolvedValue(true);
      usersService.findByPhone.mockResolvedValue(mockUser as any);
      usersService.update.mockResolvedValue({ ...mockUser, phoneVerified: true } as any);

      const result = await authService.verifyOtp({
        target: '+919876543210',
        otp: '123456',
        purpose: 'PHONE_VERIFY' as any,
      });

      expect(result.verified).toBe(true);
      expect(usersService.update).toHaveBeenCalledWith(mockUser.id, { phoneVerified: true });
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      otpService.verifyOtp.mockResolvedValue(false);

      await expect(
        authService.verifyOtp({ target: '+919876543210', otp: 'wrong', purpose: 'PHONE_VERIFY' as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('should return new access token with valid refresh token', async () => {
      const mockRefreshToken = {
        id: 'rt-uuid',
        userId: mockUser.id,
        token: 'valid-refresh-token',
        expiresAt: new Date(Date.now() + 86400000),
        isRevoked: false,
        createdAt: new Date(),
      };
      tokenService.findRefreshToken.mockResolvedValue(mockRefreshToken as any);
      usersService.findById.mockResolvedValue(mockUser as any);

      const result = await authService.refreshToken('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      tokenService.findRefreshToken.mockResolvedValue({ isRevoked: true } as any);

      await expect(authService.refreshToken('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      tokenService.findRefreshToken.mockResolvedValue({
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000),
      } as any);

      await expect(authService.refreshToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const hashedPassword = await bcrypt.hash('OldPass@123', 12);
      usersService.findById.mockResolvedValue({ ...mockUser, passwordHash: hashedPassword } as any);
      usersService.updatePassword.mockResolvedValue();
      tokenService.revokeAllUserTokens.mockResolvedValue();

      const result = await authService.changePassword(mockUser.id, {
        currentPassword: 'OldPass@123',
        newPassword: 'NewSecurePass@456',
      });

      expect(result.message).toBe('Password changed successfully');
      expect(usersService.updatePassword).toHaveBeenCalled();
      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw UnauthorizedException for wrong current password', async () => {
      usersService.findById.mockResolvedValue(mockUser as any);

      await expect(
        authService.changePassword(mockUser.id, {
          currentPassword: 'WrongPass@123',
          newPassword: 'NewPass@456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
