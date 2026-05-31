import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ChargingSessionEntity } from './charging-session.entity';

@Entity('meter_values')
@Index(['sessionId'])
@Index(['sessionId', 'timestamp'])
export class MeterValueEntity extends BaseEntity {
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ name: 'energy_kwh', type: 'decimal', precision: 10, scale: 4, nullable: true })
  energyKwh: number | null;

  @Column({ name: 'power_kw', type: 'decimal', precision: 8, scale: 3, nullable: true })
  powerKw: number | null;

  @Column({ type: 'decimal', precision: 7, scale: 2, nullable: true })
  voltage: number | null;

  @Column({ type: 'decimal', precision: 7, scale: 3, nullable: true })
  current: number | null;

  @Column({ type: 'smallint', nullable: true, comment: 'State of charge in percent' })
  soc: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  temperature: number | null;

  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData: Record<string, unknown> | null;

  @ManyToOne(() => ChargingSessionEntity, (session) => session.meterValues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: ChargingSessionEntity;
}
