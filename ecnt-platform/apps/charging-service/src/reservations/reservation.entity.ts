import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  NO_SHOW = 'no_show',
}

@Entity('reservations')
@Index(['userId', 'status'])
@Index(['chargerId', 'startTime'])
@Index(['startTime', 'endTime'])
export class ReservationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  stationId: string;

  @Index()
  @Column({ type: 'uuid' })
  chargerId: string;

  @Column({ length: 10 })
  connectorId: string;

  @Column({ type: 'uuid', nullable: true })
  vehicleId: string;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;

  @Index()
  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp' })
  endTime: Date;

  // OCPP reservation ID (integer for protocol)
  @Column({ nullable: true })
  ocppReservationId: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  reservationFeeInr: number;

  @Column({ nullable: true, type: 'uuid' })
  paymentId: string;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true, type: 'text' })
  cancellationReason: string;

  @Column({ nullable: true, type: 'uuid' })
  sessionId: string; // Linked session when reservation is used

  @Column({ nullable: true, type: 'jsonb' })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
