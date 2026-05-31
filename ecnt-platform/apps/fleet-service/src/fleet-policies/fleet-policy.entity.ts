import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export interface RestrictedHours {
  start: number;
  end: number;
}

@Entity('fleet_policies')
export class FleetPolicyEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'fleet_account_id' })
  fleetAccountId: string;

  @Column({
    name: 'max_kwh_per_day',
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  maxKwhPerDay?: number;

  @Column({
    name: 'max_amount_per_session',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maxAmountPerSession?: number;

  @Column({
    name: 'allowed_charger_types',
    type: 'jsonb',
    default: () => "'[]'",
  })
  allowedChargerTypes: string[];

  @Column({
    name: 'allowed_station_ids',
    type: 'jsonb',
    default: () => "'[]'",
  })
  allowedStationIds: string[];

  @Column({
    name: 'restricted_hours',
    type: 'jsonb',
    nullable: true,
  })
  restrictedHours?: RestrictedHours;

  @Column({ name: 'require_driver_auth', default: false })
  requireDriverAuth: boolean;

  @Column({ name: 'max_sessions_per_day', type: 'int', nullable: true })
  maxSessionsPerDay?: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
