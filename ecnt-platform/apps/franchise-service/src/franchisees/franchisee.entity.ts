import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export enum FranchiseeStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

export enum ContractType {
  REVENUE_SHARE = 'revenue_share',
  FIXED_FEE = 'fixed_fee',
  HYBRID = 'hybrid',
}

@Entity('franchisees')
export class FranchiseeEntity extends BaseEntity {
  @Column({ name: 'organization_name' })
  organizationName: string;

  @Column({ name: 'owner_name' })
  ownerName: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  gstin?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ nullable: true })
  pincode?: string;

  @Column({
    name: 'contract_type',
    type: 'enum',
    enum: ContractType,
    default: ContractType.REVENUE_SHARE,
  })
  contractType: ContractType;

  @Column({
    name: 'revenue_share_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 25,
    comment: 'Percentage of revenue that goes to franchisee',
  })
  revenueSharePercent: number;

  @Column({
    name: 'fixed_monthly_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    comment: 'Monthly fixed fee for FIXED_FEE contract type (INR)',
  })
  fixedMonthlyFee: number;

  @Column({
    type: 'enum',
    enum: FranchiseeStatus,
    default: FranchiseeStatus.PENDING,
  })
  status: FranchiseeStatus;

  @Column({ name: 'contract_start_date', type: 'date', nullable: true })
  contractStartDate?: Date;

  @Column({ name: 'contract_end_date', type: 'date', nullable: true })
  contractEndDate?: Date;

  @Column({
    name: 'total_revenue_generated',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalRevenueGenerated: number;

  @Column({
    name: 'total_commission_paid',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalCommissionPaid: number;

  @Column({
    name: 'pending_commission',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  pendingCommission: number;

  @Column({ name: 'bank_account_name', nullable: true })
  bankAccountName?: string;

  @Column({ name: 'bank_account_number', nullable: true })
  bankAccountNumber?: string;

  @Column({ name: 'bank_ifsc', nullable: true })
  bankIfsc?: string;

  @Column({ name: 'bank_name', nullable: true })
  bankName?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
