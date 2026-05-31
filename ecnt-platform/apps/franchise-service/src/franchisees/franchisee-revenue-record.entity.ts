import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('franchisee_revenue_records')
export class FranchiseeRevenueRecordEntity extends BaseEntity {
  @Index()
  @Column({ name: 'franchisee_id' })
  franchiseeId: string;

  @Column({ name: 'station_id' })
  stationId: string;

  @Column({ name: 'station_name', nullable: true })
  stationName?: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId?: string;

  @Column({
    name: 'gross_revenue',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  grossRevenue: number;

  @Column({
    name: 'franchisee_share',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  franchiseeShare: number;

  @Column({
    name: 'platform_share',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  platformShare: number;

  @Column({
    name: 'share_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  sharePercent: number;

  @Column({
    name: 'energy_kwh',
    type: 'decimal',
    precision: 8,
    scale: 3,
    default: 0,
  })
  energyKwh: number;

  @Column({ name: 'settled', default: false })
  settled: boolean;

  @Column({ name: 'settlement_id', nullable: true })
  settlementId?: string;
}
