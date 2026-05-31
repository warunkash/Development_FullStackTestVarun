import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TariffRuleEntity } from './tariff-rule.entity';

export enum TariffType {
  FLAT = 'flat',
  TIME_OF_USE = 'time_of_use',
  DYNAMIC = 'dynamic',
}

@Entity('tariffs')
@Index(['isActive'])
export class TariffEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: TariffType, default: TariffType.FLAT })
  type: TariffType;

  @Column({ name: 'price_per_kwh', type: 'decimal', precision: 8, scale: 4 })
  pricePerKwh: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ name: 'min_session_amount', type: 'decimal', precision: 8, scale: 2, default: 0 })
  minSessionAmount: number;

  @Column({ name: 'parking_fee_per_hour', type: 'decimal', precision: 8, scale: 2, default: 0 })
  parkingFeePerHour: number;

  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'valid_to', type: 'timestamptz', nullable: true })
  validTo: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'applicable_charger_types', type: 'varchar', array: true, default: [] })
  applicableChargerTypes: string[];

  @Column({ name: 'applicable_station_ids', type: 'uuid', array: true, default: [] })
  applicableStationIds: string[];

  @OneToMany(() => TariffRuleEntity, (rule) => rule.tariff, { cascade: true })
  rules: TariffRuleEntity[];
}
