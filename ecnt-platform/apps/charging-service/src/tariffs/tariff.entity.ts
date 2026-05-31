import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export enum TariffType {
  ENERGY_BASED = 'energy_based', // per kWh
  TIME_BASED = 'time_based', // per minute
  FLAT = 'flat', // flat session fee
  HYBRID = 'hybrid', // energy + time
}

export enum TariffApplicability {
  ALL = 'all', // All charger types
  AC_ONLY = 'ac_only',
  DC_ONLY = 'dc_only',
  SPECIFIC_STATION = 'specific_station',
  SPECIFIC_CHARGER = 'specific_charger',
}

@Entity('tariff_rules')
export class TariffRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tariffId: string;

  @Column({ type: 'int' }) // 0-23
  startHour: number;

  @Column({ type: 'int' }) // 0-23
  endHour: number;

  @Column({ type: 'simple-array', nullable: true }) // 0=Sun, 1=Mon...6=Sat
  daysOfWeek: number[];

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  ratePerKwh: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  ratePerMinute: number;

  @Column({ length: 50, nullable: true })
  label: string; // e.g. 'Peak', 'Off-Peak', 'Weekend'
}

@Entity('tariffs')
@Index(['isActive'])
@Index(['stationId'])
export class TariffEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TariffType,
    default: TariffType.ENERGY_BASED,
  })
  type: TariffType;

  @Column({
    type: 'enum',
    enum: TariffApplicability,
    default: TariffApplicability.ALL,
  })
  applicability: TariffApplicability;

  // Base rates
  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  baseRatePerKwh: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  baseRatePerMinute: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  sessionFeeInr: number; // Fixed session start fee

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  idlingFeePerMinute: number; // Fee after session ends but car not removed

  // Applicable scope
  @Column({ nullable: true, type: 'uuid' })
  stationId: string;

  @Column({ nullable: true, type: 'uuid' })
  chargerId: string;

  @Column({ nullable: true, type: 'uuid' })
  franchiseeId: string;

  // Min/max limits
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  minimumChargeInr: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  maximumChargeInr: number;

  // Tax
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 18 })
  taxPercentage: number; // GST

  @Column({ default: true })
  taxInclusive: boolean; // If rate already includes tax

  @Column({ default: true })
  isActive: boolean;

  // Validity
  @Column({ type: 'timestamp', nullable: true })
  validFrom: Date;

  @Column({ type: 'timestamp', nullable: true })
  validUntil: Date;

  @Column({ type: 'int', default: 100 })
  priority: number; // Higher priority tariff wins

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
