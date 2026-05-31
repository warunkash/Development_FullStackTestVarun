import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { WalletEntity } from './wallet.entity';

export enum WalletTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
  REFUND = 'refund',
  CASHBACK = 'cashback',
  ADJUSTMENT = 'adjustment',
}

export enum WalletTransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

@Entity('wallet_transactions')
@Index(['walletId'])
@Index(['referenceId'])
@Index(['createdAt'])
export class WalletTransactionEntity extends BaseEntity {
  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Column({ type: 'enum', enum: WalletTransactionType })
  type: WalletTransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ name: 'balance_before', type: 'decimal', precision: 10, scale: 2 })
  balanceBefore: number;

  @Column({ name: 'balance_after', type: 'decimal', precision: 10, scale: 2 })
  balanceAfter: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'reference_id', type: 'varchar', length: 100, nullable: true })
  referenceId: string | null;

  @Column({ name: 'reference_type', type: 'varchar', length: 50, nullable: true })
  referenceType: string | null;

  @Column({ type: 'enum', enum: WalletTransactionStatus, default: WalletTransactionStatus.COMPLETED })
  status: WalletTransactionStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ManyToOne(() => WalletEntity, (wallet) => wallet.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet_id' })
  wallet: WalletEntity;
}
