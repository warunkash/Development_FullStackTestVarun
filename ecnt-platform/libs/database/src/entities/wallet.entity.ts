import { Entity, Column, Index, OneToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { WalletTransactionEntity } from './wallet-transaction.entity';

@Entity('wallets')
@Index(['userId'], { unique: true })
export class WalletEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'total_credited', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalCredited: number;

  @Column({ name: 'total_debited', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalDebited: number;

  @OneToOne(() => UserEntity, (user) => user.wallet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToMany(() => WalletTransactionEntity, (transaction) => transaction.wallet)
  transactions: WalletTransactionEntity[];
}
