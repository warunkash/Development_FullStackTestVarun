import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('chargers')
@Index(['ocppChargePointId'], { unique: true })
export class ChargerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  stationId: string;

  @Column({ length: 100 })
  serialNumber: string;

  @Column({ length: 100 })
  model: string;

  @Column({ length: 100 })
  manufacturer: string;

  @Column({ length: 100, unique: true })
  ocppChargePointId: string;

  @Column({ nullable: true, length: 50 })
  firmwareVersion: string;

  @Column({ length: 50, default: 'offline' })
  status: string;

  @Column({ nullable: true, type: 'timestamp' })
  lastHeartbeatAt: Date;

  @Column({ nullable: true, type: 'jsonb' })
  connectorStatuses: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
