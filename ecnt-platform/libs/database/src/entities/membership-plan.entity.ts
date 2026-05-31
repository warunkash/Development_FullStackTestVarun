import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { MembershipEntity } from './membership.entity';

export enum BillingPeriod {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
}

@Entity('membership_plans')
@Index(['isActive'])
export class MembershipPlanEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ name: 'billing_period', type: 'enum', enum: BillingPeriod, default: BillingPeriod.MONTHLY })
  billingPeriod: BillingPeriod;

  @Column({ type: 'jsonb', default: [] })
  features: string[];

  @Column({ name: 'discount_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ name: 'wallet_cashback_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  walletCashbackPercent: number;

  @Column({ name: 'free_charging_kwh', type: 'decimal', precision: 8, scale: 2, default: 0 })
  freeChargingKwh: number;

  @Column({ name: 'max_charging_rate_kw', type: 'decimal', precision: 6, scale: 2, nullable: true })
  maxChargingRateKw: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => MembershipEntity, (membership) => membership.plan)
  memberships: MembershipEntity[];
}
