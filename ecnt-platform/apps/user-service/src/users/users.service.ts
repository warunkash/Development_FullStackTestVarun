import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { User, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserStats {
  totalSessions: number;
  totalEnergyKwh: number;
  totalSpendInr: number;
  totalCo2SavedKg: number;
  favoriteStation: string | null;
  memberSince: Date;
  walletBalance: number;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'ap-south-1'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME', 'ecnt-user-assets');
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existingEmail = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException('Email already registered');

    const existingPhone = await this.userRepository.findOne({ where: { phone: dto.phone } });
    if (existingPhone) throw new ConflictException('Phone number already registered');

    const referralCode = this.generateReferralCode(dto.firstName);
    const user = this.userRepository.create({
      ...dto,
      referralCode,
      referredBy: dto.referralCode || null,
    });

    const saved = await this.userRepository.save(user);
    this.eventEmitter.emit('user.created', { userId: saved.id, email: saved.email });
    this.logger.log(`User created: ${saved.email}`);
    return saved;
  }

  async findAll(filterDto: UserFilterDto): Promise<PaginatedResult<User>> {
    const { page, limit, search, status, emailVerified, phoneVerified, role, sortBy, sortOrder } =
      filterDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (search) {
      queryBuilder.where(
        '(user.email ILIKE :search OR user.phone ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (status) queryBuilder.andWhere('user.status = :status', { status });
    if (emailVerified !== undefined)
      queryBuilder.andWhere('user.emailVerified = :emailVerified', { emailVerified });
    if (phoneVerified !== undefined)
      queryBuilder.andWhere('user.phoneVerified = :phoneVerified', { phoneVerified });
    if (role) queryBuilder.andWhere(':role = ANY(user.roles)', { role });

    const validSortFields = ['createdAt', 'email', 'firstName', 'lastName', 'lastLoginAt'];
    const sort = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder
      .orderBy(`user.${sort}`, sortOrder || 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['vehicles', 'wallet', 'memberships'],
    });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phone } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, dto);
    const updated = await this.userRepository.save(user);
    this.eventEmitter.emit('user.updated', { userId: id });
    return updated;
  }

  async uploadProfileImage(id: string, file: Express.Multer.File): Promise<User> {
    const user = await this.findById(id);

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG and WebP images are allowed');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size must be less than 5MB');
    }

    const ext = file.originalname.split('.').pop();
    const key = `profile-images/${id}/${uuidv4()}.${ext}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read',
          Metadata: { userId: id },
        }),
      );
    } catch (error) {
      this.logger.error(`S3 upload failed for user ${id}`, error);
      throw new BadRequestException('Failed to upload image. Please try again.');
    }

    // Delete old image if exists
    if (user.profileImageUrl) {
      const oldKey = user.profileImageUrl.split('/').slice(-3).join('/');
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({ Bucket: this.bucketName, Key: oldKey }),
        );
      } catch (err) {
        this.logger.warn(`Failed to delete old profile image for user ${id}`);
      }
    }

    const imageUrl = `https://${this.bucketName}.s3.ap-south-1.amazonaws.com/${key}`;
    return this.update(id, { ...dto } as any);
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findById(id);
    if (user.status === UserStatus.INACTIVE) {
      throw new BadRequestException('User is already inactive');
    }
    user.status = UserStatus.INACTIVE;
    const updated = await this.userRepository.save(user);
    this.eventEmitter.emit('user.deactivated', { userId: id });
    return updated;
  }

  async suspend(id: string, reason: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.SUSPENDED;
    user.suspensionReason = reason;
    const updated = await this.userRepository.save(user);
    this.eventEmitter.emit('user.suspended', { userId: id, reason });
    this.logger.warn(`User ${id} suspended: ${reason}`);
    return updated;
  }

  async reactivate(id: string): Promise<User> {
    const user = await this.findById(id);
    if (user.status === UserStatus.ACTIVE) {
      throw new BadRequestException('User is already active');
    }
    user.status = UserStatus.ACTIVE;
    user.suspensionReason = null;
    const updated = await this.userRepository.save(user);
    this.eventEmitter.emit('user.reactivated', { userId: id });
    return updated;
  }

  async getStats(id: string): Promise<UserStats> {
    const user = await this.findById(id);
    // In a real implementation these would be fetched from session/billing service
    // via event sourcing or direct DB queries to the charging sessions table
    return {
      totalSessions: 0,
      totalEnergyKwh: 0,
      totalSpendInr: 0,
      totalCo2SavedKg: 0,
      favoriteStation: null,
      memberSince: user.createdAt,
      walletBalance: user.wallet?.balance || 0,
    };
  }

  private generateReferralCode(firstName: string): string {
    const prefix = firstName.substring(0, 3).toUpperCase();
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${suffix}`;
  }

  private get dto() {
    return UpdateUserDto;
  }
}
