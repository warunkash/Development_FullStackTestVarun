import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Membership, MembershipStatus } from './entities/membership.entity';
import { MembershipPlan } from './entities/membership-plan.entity';
import { WalletsService } from '../wallets/wallets.service';

export interface MembershipBenefits {
  hasActiveMembership: boolean;
  discountPercentage: number;
  freeSessionsRemaining: number;
  planName: string | null;
  expiresAt: Date | null;
}

@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipPlan)
    private readonly planRepository: Repository<MembershipPlan>,
    private readonly walletsService: WalletsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getPlans(): Promise<MembershipPlan[]> {
    return this.planRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', priceInr: 'ASC' },
    });
  }

  async subscribeToPlan(
    userId: string,
    planId: string,
    paymentId: string,
  ): Promise<Membership> {
    // Check for existing active membership
    const existingActive = await this.membershipRepository.findOne({
      where: { userId, status: MembershipStatus.ACTIVE },
    });
    if (existingActive) {
      throw new ConflictException(
        'You already have an active membership. Cancel it first to subscribe to a new plan.',
      );
    }

    const plan = await this.planRepository.findOne({ where: { id: planId, isActive: true } });
    if (!plan) throw new NotFoundException('Membership plan not found or inactive');

    // Deduct from wallet
    await this.walletsService.deduct(
      userId,
      plan.priceInr,
      `Membership: ${plan.name}`,
      planId,
    );

    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setDate(endsAt.getDate() + plan.durationDays);

    const membership = this.membershipRepository.create({
      userId,
      planId,
      status: MembershipStatus.ACTIVE,
      startsAt: now,
      endsAt,
      paymentId,
      amountPaid: plan.priceInr,
      sessionsUsedThisMonth: 0,
    });

    const saved = await this.membershipRepository.save(membership);
    this.eventEmitter.emit('membership.subscribed', {
      userId,
      planId,
      planName: plan.name,
      endsAt,
    });
    this.logger.log(`User ${userId} subscribed to plan ${plan.name}`);
    return saved;
  }

  async getUserMembership(userId: string): Promise<Membership | null> {
    return this.membershipRepository.findOne({
      where: { userId, status: MembershipStatus.ACTIVE },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async cancelMembership(userId: string): Promise<Membership> {
    const membership = await this.membershipRepository.findOne({
      where: { userId, status: MembershipStatus.ACTIVE },
      relations: ['plan'],
    });

    if (!membership) {
      throw new NotFoundException('No active membership found');
    }

    membership.status = MembershipStatus.CANCELLED;
    membership.cancelledAt = new Date();
    membership.autoRenew = false;

    const updated = await this.membershipRepository.save(membership);
    this.eventEmitter.emit('membership.cancelled', { userId, planName: membership.plan.name });
    this.logger.log(`Membership cancelled for user ${userId}`);
    return updated;
  }

  async checkMembershipBenefits(userId: string): Promise<MembershipBenefits> {
    const membership = await this.getUserMembership(userId);

    if (!membership || membership.status !== MembershipStatus.ACTIVE || new Date() > membership.endsAt) {
      return {
        hasActiveMembership: false,
        discountPercentage: 0,
        freeSessionsRemaining: 0,
        planName: null,
        expiresAt: null,
      };
    }

    const plan = membership.plan;
    const freeSessionsRemaining = Math.max(
      0,
      plan.freeSessionsPerMonth - membership.sessionsUsedThisMonth,
    );

    return {
      hasActiveMembership: true,
      discountPercentage: plan.discountPercentage,
      freeSessionsRemaining,
      planName: plan.name,
      expiresAt: membership.endsAt,
    };
  }

  async getMembershipHistory(userId: string): Promise<Membership[]> {
    return this.membershipRepository.find({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  // Cron job to expire memberships daily at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireOldMemberships(): Promise<void> {
    const result = await this.membershipRepository
      .createQueryBuilder()
      .update(Membership)
      .set({ status: MembershipStatus.EXPIRED })
      .where('status = :status', { status: MembershipStatus.ACTIVE })
      .andWhere('ends_at <= :now', { now: new Date() })
      .execute();

    if (result.affected > 0) {
      this.logger.log(`Expired ${result.affected} memberships`);
    }
  }

  // Reset monthly session count on 1st of each month
  @Cron('0 0 1 * *')
  async resetMonthlySessions(): Promise<void> {
    const result = await this.membershipRepository
      .createQueryBuilder()
      .update(Membership)
      .set({ sessionsUsedThisMonth: 0 })
      .where('status = :status', { status: MembershipStatus.ACTIVE })
      .execute();

    this.logger.log(`Reset session counts for ${result.affected} active memberships`);
  }
}
