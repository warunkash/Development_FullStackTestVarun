import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import * as twilio from 'twilio';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private redisClient: RedisClientType;
  private twilioClient: twilio.Twilio;
  private readonly OTP_TTL_SECONDS = 300; // 5 minutes
  private readonly MAX_ATTEMPTS = 5;

  constructor(private readonly configService: ConfigService) {
    this.initRedis();
    this.initTwilio();
  }

  private async initRedis() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redisClient = createClient({ url: redisUrl }) as RedisClientType;
    this.redisClient.on('error', (err) => this.logger.error('Redis error', err));
    await this.redisClient.connect();
    this.logger.log('Redis connected for OTP service');
  }

  private initTwilio() {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    if (accountSid && authToken) {
      this.twilioClient = twilio.default(accountSid, authToken);
    } else {
      this.logger.warn('Twilio credentials not configured - SMS will be mocked');
    }
  }

  private generateOtp(length = 6): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  private getRedisKey(target: string, purpose: string): string {
    return `otp:${purpose}:${target}`;
  }

  private getAttemptsKey(target: string, purpose: string): string {
    return `otp_attempts:${purpose}:${target}`;
  }

  async sendSmsOtp(phone: string, purpose: string): Promise<void> {
    const otp = this.generateOtp(6);
    const key = this.getRedisKey(phone, purpose);

    await this.redisClient.set(key, otp, { EX: this.OTP_TTL_SECONDS });
    await this.redisClient.del(this.getAttemptsKey(phone, purpose));

    const message = `Your ECNT OTP for ${purpose} is: ${otp}. Valid for 5 minutes. Do not share.`;

    if (this.twilioClient) {
      try {
        await this.twilioClient.messages.create({
          body: message,
          from: this.configService.get<string>('TWILIO_FROM_NUMBER'),
          to: phone,
        });
        this.logger.log(`SMS OTP sent to ${phone} for ${purpose}`);
      } catch (error) {
        this.logger.error(`Failed to send SMS to ${phone}`, error);
        throw new InternalServerErrorException('Failed to send OTP. Please try again.');
      }
    } else {
      // Development mock
      this.logger.debug(`[MOCK SMS] OTP for ${phone} (${purpose}): ${otp}`);
    }
  }

  async sendEmailOtp(email: string, purpose: string): Promise<void> {
    const otp = this.generateOtp(6);
    const key = this.getRedisKey(email, purpose);

    await this.redisClient.set(key, otp, { EX: this.OTP_TTL_SECONDS });
    await this.redisClient.del(this.getAttemptsKey(email, purpose));

    // In production, integrate with email service (SES, SendGrid, etc.)
    this.logger.debug(`[EMAIL OTP] To: ${email}, Purpose: ${purpose}, OTP: ${otp}`);
  }

  async verifyOtp(target: string, otp: string, purpose: string): Promise<boolean> {
    const key = this.getRedisKey(target, purpose);
    const attemptsKey = this.getAttemptsKey(target, purpose);

    // Check attempts
    const attempts = await this.redisClient.incr(attemptsKey);
    if (attempts === 1) {
      await this.redisClient.expire(attemptsKey, this.OTP_TTL_SECONDS);
    }

    if (attempts > this.MAX_ATTEMPTS) {
      await this.redisClient.del(key);
      this.logger.warn(`OTP brute force detected for ${target} (${purpose})`);
      return false;
    }

    const storedOtp = await this.redisClient.get(key);
    if (!storedOtp || storedOtp !== otp) {
      return false;
    }

    // Invalidate OTP after successful verification
    await this.redisClient.del(key);
    await this.redisClient.del(attemptsKey);
    return true;
  }
}
