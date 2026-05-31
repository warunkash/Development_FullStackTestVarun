import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

export enum SessionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum StopReason {
  LOCAL = 'Local',
  REMOTE = 'Remote',
  EV_DISCONNECTED = 'EVDisconnected',
  HARD_RESET = 'HardReset',
  SOFT_RESET = 'SoftReset',
  DEAUTHORIZED = 'DeAuthorized',
  EMERGENCY_STOP = 'EmergencyStop',
  POWER_LOSS = 'PowerLoss',
  OTHER = 'Other',
}

@Entity('sessions')
@Index(['userId', 'status'])
@Index(['stationId', 'startTime'])
@Index(['chargerId', 'status'])
@Index(['startTime'])
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  sessionId: string; // Human-readable session ID e.g. TXN_20240101_123456

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Index()
  @Column({ type: 'uuid' })
  stationId: string;

  @Column({ type: 'uuid' })
  chargerId: string;

  @Column({ length: 10 })
  connectorId: string; // '1' or '2'

  @Column({ type: 'uuid', nullable: true })
  vehicleId: string;

  @Column({ type: 'uuid', nullable: true })
  tariffId: string;

  @Column({ type: 'uuid', nullable: true })
  reservationId: string;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.PENDING,
  })
  status: SessionStatus;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  energyDeliveredKwh: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  maxPowerKw: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  averagePowerKw: number;

  // Billing
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCostInr: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  energyCostInr: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  timeCostInr: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  sessionFeeInr: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  taxPercentage: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  taxAmountInr: number;

  // Payment
  @Column({ nullable: true, type: 'uuid' })
  paymentId: string;

  @Column({ nullable: true, length: 50 })
  paymentStatus: string;

  // OCPP data
  @Column({ nullable: true })
  ocppTransactionId: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  meterStart: number; // Wh

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  meterStop: number; // Wh

  @Column({ nullable: true, length: 100 })
  stopReason: string;

  // User info at time of session
  @Column({ nullable: true, length: 100 })
  rfidTag: string;

  @Column({ nullable: true, length: 10 })
  initialSoc: string; // State of charge at start

  @Column({ nullable: true, length: 10 })
  finalSoc: string; // State of charge at end

  @Column({ type: 'decimal', precision: 8, scale: 0, nullable: true })
  durationSeconds: number;

  @Column({ nullable: true, type: 'jsonb' })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}

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
  soc: number; // State of charge %

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  voltage: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  current: number;

  @Column({ type: 'decimal', precision: 6, scale: 1, nullable: true })
  temperature: number;

  @Column({ type: 'jsonb', nullable: true })
  rawSampledValues: any[];

  @CreateDateColumn()
  createdAt: Date;
}
