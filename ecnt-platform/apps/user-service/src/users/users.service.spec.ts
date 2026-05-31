import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserStatus } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserRepository: any;
  let mockConfigService: any;
  let mockEventEmitter: any;

  const mockUser: Partial<User> = {
    id: 'user-uuid-123',
    email: 'john@example.com',
    phone: '+919876543210',
    firstName: 'John',
    lastName: 'Doe',
    status: UserStatus.ACTIVE,
    roles: ['user'],
    emailVerified: false,
    phoneVerified: false,
    referralCode: 'JOH123ABC',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    mockUserRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      })),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: any) => defaultVal),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    const createDto = {
      email: 'john@example.com',
      phone: '+919876543210',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should create a new user successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(createDto as any);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('user.created', expect.any(Object));
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser); // email check returns existing

      await expect(service.create(createDto as any)).rejects.toThrow(ConflictException);
      await expect(service.create(createDto as any)).rejects.toThrow('Email already registered');
    });

    it('should throw ConflictException for duplicate phone', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // email check passes
        .mockResolvedValueOnce(mockUser); // phone check fails

      await expect(service.create(createDto as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return a user when found', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('user-uuid-123');
      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid-123' },
        relations: ['vehicles', 'wallet', 'memberships'],
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findById('nonexistent-id')).rejects.toThrow(
        'User with ID nonexistent-id not found',
      );
    });
  });

  describe('update', () => {
    it('should update user and return updated data', async () => {
      const updatedUser = { ...mockUser, firstName: 'Jane' };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.update('user-uuid-123', { firstName: 'Jane' } as any);

      expect(result.firstName).toBe('Jane');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('user.updated', { userId: 'user-uuid-123' });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.update('bad-id', { firstName: 'X' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deactivate', () => {
    it('should deactivate an active user', async () => {
      const activeUser = { ...mockUser, status: UserStatus.ACTIVE };
      const deactivatedUser = { ...mockUser, status: UserStatus.INACTIVE };
      mockUserRepository.findOne.mockResolvedValue(activeUser);
      mockUserRepository.save.mockResolvedValue(deactivatedUser);

      const result = await service.deactivate('user-uuid-123');

      expect(result.status).toBe(UserStatus.INACTIVE);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('user.deactivated', { userId: 'user-uuid-123' });
    });

    it('should throw BadRequestException if user already inactive', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, status: UserStatus.INACTIVE });

      await expect(service.deactivate('user-uuid-123')).rejects.toThrow(BadRequestException);
      await expect(service.deactivate('user-uuid-123')).rejects.toThrow('User is already inactive');
    });
  });

  describe('suspend', () => {
    it('should suspend a user with a reason', async () => {
      const suspendedUser = {
        ...mockUser,
        status: UserStatus.SUSPENDED,
        suspensionReason: 'Fraudulent activity',
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(suspendedUser);

      const result = await service.suspend('user-uuid-123', 'Fraudulent activity');

      expect(result.status).toBe(UserStatus.SUSPENDED);
      expect(result.suspensionReason).toBe('Fraudulent activity');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('user.suspended', {
        userId: 'user-uuid-123',
        reason: 'Fraudulent activity',
      });
    });
  });

  describe('reactivate', () => {
    it('should reactivate a suspended user', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };
      const reactivatedUser = { ...mockUser, status: UserStatus.ACTIVE, suspensionReason: null };
      mockUserRepository.findOne.mockResolvedValue(suspendedUser);
      mockUserRepository.save.mockResolvedValue(reactivatedUser);

      const result = await service.reactivate('user-uuid-123');

      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('user.reactivated', { userId: 'user-uuid-123' });
    });

    it('should throw BadRequestException if user is already active', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser); // status is ACTIVE

      await expect(service.reactivate('user-uuid-123')).rejects.toThrow(BadRequestException);
      await expect(service.reactivate('user-uuid-123')).rejects.toThrow('User is already active');
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockUser], 1]),
      };
      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll({ page: 1, limit: 20 } as any);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });
});
