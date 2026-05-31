import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum WalletTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
  REFUND = 'refund',
  BONUS = 'bonus',
  CASHBACK = 'cashback',
  TOPUP = 'topup',
  EXPIRY = 'expiry',
}

@Entity('wallets')
export class WalletEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Index({ unique: true })
  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'balance',
  })
  balance: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'locked_balance',
  })
  lockedBalance: number;

  @Column({ default: 'INR' })
  currency: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'total_credited', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCredited: number;

  @Column({ name: 'total_debited', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalDebited: number;

  @Column({ name: 'cashback_earned', type: 'decimal', precision: 12, scale: 2, default: 0 })
  cashbackEarned: number;
}

@Entity('wallet_transactions')
export class WalletTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Index()
  @Column({ name: 'wallet_id' })
  walletId: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: WalletTransactionType })
  type: WalletTransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'balance_after' })
  balanceAfter: number;

  @Column({ nullable: true })
  description?: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId?: string;

  @Column({ name: 'payment_id', nullable: true })
  paymentId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}
