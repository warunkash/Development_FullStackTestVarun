import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export enum PaymentType {
  COMMISSION = 'commission',
  FRANCHISE_FEE = 'franchise_fee',
  SECURITY_DEPOSIT = 'security_deposit',
  PENALTY = 'penalty',
  REFUND = 'refund',
}

@Entity('franchisee_payments')
export class FranchiseePaymentEntity extends BaseEntity {
  @Index()
  @Column({ name: 'franchisee_id' })
  franchiseeId: string;

  @Column({
    name: 'payment_type',
    type: 'enum',
    enum: PaymentType,
  })
  paymentType: PaymentType;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  amount: number;

  @Column({ name: 'reference_id', nullable: true })
  referenceId?: string;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate?: Date;

  @Column({ default: 'completed' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart?: Date;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd?: Date;
}
