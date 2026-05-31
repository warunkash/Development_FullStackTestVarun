import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TariffEntity } from './tariff.entity';

@Entity('tariff_rules')
@Index(['tariffId'])
export class TariffRuleEntity extends BaseEntity {
  @Column({ name: 'tariff_id', type: 'uuid' })
  tariffId: string;

  @Column({ name: 'rule_name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'day_of_week', type: 'smallint', nullable: true, comment: '0=Sunday, 6=Saturday, null=all days' })
  dayOfWeek: number | null;

  @Column({ name: 'start_hour', type: 'smallint' })
  startHour: number;

  @Column({ name: 'end_hour', type: 'smallint' })
  endHour: number;

  @Column({ name: 'price_per_kwh', type: 'decimal', precision: 8, scale: 4, nullable: true })
  pricePerKwh: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1.0 })
  multiplier: number;

  @ManyToOne(() => TariffEntity, (tariff) => tariff.rules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tariff_id' })
  tariff: TariffEntity;
}
