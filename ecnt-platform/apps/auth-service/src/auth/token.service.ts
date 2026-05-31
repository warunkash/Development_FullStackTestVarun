import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly configService: ConfigService,
  ) {}

  async createRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const token = uuidv4();
    const expiryDays = this.configService.get<number>('JWT_REFRESH_EXPIRY_DAYS', 30);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const refreshToken = this.refreshTokenRepository.create({
      userId,
      token,
      expiresAt,
      isRevoked: false,
      ipAddress,
      userAgent,
    });

    await this.refreshTokenRepository.save(refreshToken);
    this.logger.debug(`Refresh token created for user: ${userId}`);
    return token;
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.refreshTokenRepository.findOne({
      where: { token },
      relations: ['user'],
    });
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { token },
      { isRevoked: true },
    );
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );
    this.logger.log(`All tokens revoked for user: ${userId}`);
  }

  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: new Date() })
      .orWhere('is_revoked = true')
      .execute();
    this.logger.log(`Cleaned up ${result.affected} expired/revoked tokens`);
  }

  async getUserActiveSessions(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokenRepository.find({
      where: { userId, isRevoked: false },
      order: { createdAt: 'DESC' },
    });
  }
}
