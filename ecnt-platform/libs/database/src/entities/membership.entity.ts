import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { MembershipPlanEntity } from './membership-plan.entity';

export enum MembershipStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
}

@Entity('memberships')
@Index(['userId'])
@Index(['planId'])
@Index(['status'])
@Index(['endDate'])
export class MembershipEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ type: 'enum', enum: MembershipStatus, default: MembershipStatus.ACTIVE })
  status: MembershipStatus;

  @Column({ name: 'auto_renew', type: 'boolean', default: true })
  autoRenew: boolean;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ name: 'remaining_free_kwh', type: 'decimal', precision: 8, scale: 2, default: 0 })
  remainingFreeKwh: number;

  @ManyToOne(() => UserEntity, (user) => user.memberships)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => MembershipPlanEntity, (plan) => plan.memberships)
  @JoinColumn({ name: 'plan_id' })
  plan: MembershipPlanEntity;
}
