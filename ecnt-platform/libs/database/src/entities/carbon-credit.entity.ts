import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { StationEntity } from './station.entity';

export enum CarbonCreditStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  SOLD = 'sold',
  RETIRED = 'retired',
}

@Entity('carbon_credits')
@Index(['stationId'])
@Index(['status'])
@Index(['periodStart', 'periodEnd'])
export class CarbonCreditEntity extends BaseEntity {
  @Column({ name: 'station_id', type: 'uuid' })
  stationId: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: Date;

  @Column({ name: 'total_energy_kwh', type: 'decimal', precision: 14, scale: 3 })
  totalEnergyKwh: number;

  @Column({ name: 'co2_saved_kg', type: 'decimal', precision: 14, scale: 3 })
  co2SavedKg: number;

  @Column({ name: 'credits_earned', type: 'decimal', precision: 14, scale: 6 })
  creditsEarned: number;

  @Column({ type: 'enum', enum: CarbonCreditStatus, default: CarbonCreditStatus.PENDING })
  status: CarbonCreditStatus;

  @Column({ name: 'verification_body', type: 'varchar', length: 200, nullable: true })
  verificationBody: string | null;

  @Column({ name: 'verification_date', type: 'date', nullable: true })
  verificationDate: Date | null;

  @Column({ name: 'certificate_url', type: 'varchar', length: 1000, nullable: true })
  certificateUrl: string | null;

  @Column({ name: 'sold_at', type: 'timestamptz', nullable: true })
  soldAt: Date | null;

  @Column({ name: 'sale_price', type: 'decimal', precision: 10, scale: 4, nullable: true })
  salePrice: number | null;

  @Column({ name: 'sale_revenue', type: 'decimal', precision: 12, scale: 2, nullable: true })
  saleRevenue: number | null;

  @ManyToOne(() => StationEntity)
  @JoinColumn({ name: 'station_id' })
  station: StationEntity;
}
