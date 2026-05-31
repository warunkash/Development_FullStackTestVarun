import { Entity, Column, Index, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { StationEntity } from './station.entity';

export enum FranchiseeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

@Entity('franchisees')
@Index(['userId'], { unique: true })
@Index(['status'])
export class FranchiseeEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'business_name', type: 'varchar', length: 200 })
  businessName: string;

  @Column({ name: 'gst_number', type: 'varchar', length: 20, nullable: true })
  gstNumber: string | null;

  @Column({ name: 'pan_number', type: 'varchar', length: 15, nullable: true })
  panNumber: string | null;

  @Column({ type: 'varchar', length: 500 })
  address: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Column({ type: 'varchar', length: 10 })
  pincode: string;

  @Column({ name: 'contract_start_date', type: 'date', nullable: true })
  contractStartDate: Date | null;

  @Column({ name: 'contract_end_date', type: 'date', nullable: true })
  contractEndDate: Date | null;

  @Column({ name: 'revenue_share_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  revenueSharePercent: number;

  @Column({ type: 'enum', enum: FranchiseeStatus, default: FranchiseeStatus.ACTIVE })
  status: FranchiseeStatus;

  @Column({ name: 'bank_account_number', type: 'varchar', length: 100, nullable: true })
  bankAccountNumber: string | null;

  @Column({ name: 'bank_ifsc_code', type: 'varchar', length: 20, nullable: true })
  bankIfscCode: string | null;

  @Column({ name: 'bank_account_name', type: 'varchar', length: 200, nullable: true })
  bankAccountName: string | null;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToMany(() => StationEntity, (station) => station.franchisee)
  stations: StationEntity[];
}
