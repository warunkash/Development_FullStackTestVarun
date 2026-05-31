import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export enum FleetType {
  DELIVERY = 'delivery',
  TAXI = 'taxi',
  CORPORATE = 'corporate',
  BUS = 'bus',
  AMBULANCE = 'ambulance',
}

export enum BillingCycle {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('fleet_accounts')
export class FleetAccountEntity extends BaseEntity {
  @Index()
  @Column({ name: 'organization_name' })
  organizationName: string;

  @Column({ type: 'enum', enum: FleetType, name: 'fleet_type' })
  fleetType: FleetType;

  @Index()
  @Column({ nullable: true, unique: true })
  gstin?: string;

  @Column({ name: 'contact_person_name' })
  contactPersonName: string;

  @Index()
  @Column({ unique: true })
  email: string;

  @Column()
  phone: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({
    name: 'billing_cycle',
    type: 'enum',
    enum: BillingCycle,
    default: BillingCycle.MONTHLY,
  })
  billingCycle: BillingCycle;

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  creditLimit: number;

  @Column({
    name: 'current_outstanding',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  currentOutstanding: number;

  @Index()
  @Column({ default: 'active' })
  status: string;

  @Column({ name: 'contract_start_date', type: 'date', nullable: true })
  contractStartDate?: Date;

  @Column({ name: 'contract_end_date', type: 'date', nullable: true })
  contractEndDate?: Date;

  @Column({
    name: 'discount_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  discountPercent: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;
}
