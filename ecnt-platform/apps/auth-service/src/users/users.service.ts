import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { v4 as uuidv4 } from 'uuid';

export interface CreateUserData {
  email: string;
  phone: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  referralCode?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(data: CreateUserData): Promise<User> {
    const referralCode = this.generateReferralCode(data.firstName);
    const user = this.userRepository.create({
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      roles: [UserRole.USER],
      referralCode,
      referredBy: data.referralCode || null,
    });

    try {
      return await this.userRepository.save(user);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Email or phone already exists');
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.mfaSecret')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.mfaSecret')
      .where('user.phone = :phone', { phone })
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.mfaSecret')
      .where('user.id = :id', { id })
      .getOne();
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepository.update(id, data);
    return this.findById(id);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.userRepository.update(id, { passwordHash });
    this.logger.log(`Password updated for user: ${id}`);
  }

  private generateReferralCode(firstName: string): string {
    const prefix = firstName.substring(0, 3).toUpperCase();
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${suffix}`;
  }
}
