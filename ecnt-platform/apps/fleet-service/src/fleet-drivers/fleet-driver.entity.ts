import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('fleet_drivers')
export class FleetDriverEntity extends BaseEntity {
  @Index()
  @Column({ name: 'fleet_account_id' })
  fleetAccountId: string;

  @Column()
  name: string;

  @Index()
  @Column({ name: 'license_number', unique: true })
  licenseNumber: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ name: 'license_expiry', type: 'date', nullable: true })
  licenseExpiry?: Date;

  @Index()
  @Column({ default: 'active' })
  status: string;

  @Column({ name: 'total_sessions', type: 'int', default: 0 })
  totalSessions: number;

  @Column({ name: 'total_kwh', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalKwh: number;

  @Column({ name: 'total_spend', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalSpend: number;

  @Column({ name: 'employee_id', nullable: true })
  employeeId?: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;
}
