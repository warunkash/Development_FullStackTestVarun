import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('meter_values')
@Index(['sessionId', 'timestamp'])
export class MeterValueEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  sessionId: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  energyKwh: number;

  @Column({ type: 'decimal', precision: 8, scale: 3, nullable: true })
  powerKw: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  soc: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  voltage: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  current: number;

  @Column({ type: 'jsonb', nullable: true })
  rawSampledValues: any[];

  @CreateDateColumn()
  createdAt: Date;
}
