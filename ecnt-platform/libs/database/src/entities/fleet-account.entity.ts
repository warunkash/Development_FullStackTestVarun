import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum BillingCycle {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum FleetAccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('fleet_accounts')
@Index(['status'])
@Index(['gstin'])
export class FleetAccountEntity extends BaseEntity {
  @Column({ name: 'organization_name', type: 'varchar', length: 200 })
  organizationName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gstin: string | null;

  @Column({ name: 'contact_person_name', type: 'varchar', length: 150 })
  contactPersonName: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'billing_cycle', type: 'enum', enum: BillingCycle, default: BillingCycle.MONTHLY })
  billingCycle: BillingCycle;

  @Column({ name: 'credit_limit', type: 'decimal', precision: 12, scale: 2, default: 0 })
  creditLimit: number;

  @Column({ name: 'current_balance', type: 'decimal', precision: 12, scale: 2, default: 0 })
  currentBalance: number;

  @Column({ type: 'enum', enum: FleetAccountStatus, default: FleetAccountStatus.ACTIVE })
  status: FleetAccountStatus;

  @Column({ name: 'billing_address', type: 'jsonb', nullable: true })
  billingAddress: Record<string, unknown> | null;

  @Column({ name: 'max_vehicles', type: 'int', nullable: true })
  maxVehicles: number | null;
}
