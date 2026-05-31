import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum AdType {
  BANNER = 'banner',
  VIDEO = 'video',
  SPONSORED = 'sponsored',
}

export enum AdStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('advertisements')
@Index(['status'])
@Index(['startDate', 'endDate'])
export class AdvertisementEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'image_url', type: 'varchar', length: 1000, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'target_url', type: 'varchar', length: 1000, nullable: true })
  targetUrl: string | null;

  @Column({ type: 'enum', enum: AdType, default: AdType.BANNER })
  type: AdType;

  @Column({ name: 'target_audience', type: 'jsonb', nullable: true })
  targetAudience: Record<string, unknown> | null;

  @Column({ name: 'display_locations', type: 'varchar', array: true, default: [] })
  displayLocations: string[];

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  budget: number;

  @Column({ name: 'spent_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  spentAmount: number;

  @Column({ type: 'bigint', default: 0 })
  impressions: number;

  @Column({ type: 'bigint', default: 0 })
  clicks: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  ctr: number;

  @Column({ type: 'enum', enum: AdStatus, default: AdStatus.DRAFT })
  status: AdStatus;
}
