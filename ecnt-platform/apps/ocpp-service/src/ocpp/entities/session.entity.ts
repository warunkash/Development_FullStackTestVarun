import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sessions')
@Index(['chargerId', 'status'])
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  sessionId: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Column({ type: 'uuid' })
  stationId: string;

  @Column({ type: 'uuid' })
  chargerId: string;

  @Column({ length: 10 })
  connectorId: string;

  @Column({ length: 50, default: 'active' })
  status: string;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  energyDeliveredKwh: number;

  @Column({ nullable: true })
  ocppTransactionId: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  meterStart: number;

  @Column({ nullable: true, length: 100 })
  stopReason: string;

  @Column({ nullable: true, type: 'uuid' })
  tariffId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCostInr: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
