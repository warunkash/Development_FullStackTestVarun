import { Entity, Column, Index, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { VehicleEntity } from './vehicle.entity';
import { StationEntity } from './station.entity';
import { ChargerEntity } from './charger.entity';
import { ConnectorEntity } from './connector.entity';
import { MeterValueEntity } from './meter-value.entity';
import { PaymentEntity } from './payment.entity';

export enum SessionStatus {
  STARTING = 'starting',
  ACTIVE = 'active',
  STOPPING = 'stopping',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum StopReason {
  EV_DISCONNECTED = 'ev_disconnected',
  LOCAL = 'local',
  REMOTE = 'remote',
  HARD_RESET = 'hard_reset',
  POWER_LOSS = 'power_loss',
  OTHER = 'other',
}

@Entity('charging_sessions')
@Index(['userId'])
@Index(['stationId'])
@Index(['chargerId'])
@Index(['vehicleId'])
@Index(['sessionId'], { unique: true })
@Index(['status'])
@Index(['startTime'])
@Index(['paymentStatus'])
export class ChargingSessionEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId: string | null;

  @Column({ name: 'station_id', type: 'uuid' })
  stationId: string;

  @Column({ name: 'charger_id', type: 'uuid' })
  chargerId: string;

  @Column({ name: 'connector_id', type: 'uuid', nullable: true })
  connectorId: string | null;

  @Column({ name: 'session_id', type: 'varchar', length: 100, unique: true })
  sessionId: string;

  @Column({ name: 'ocpp_transaction_id', type: 'int', nullable: true })
  ocppTransactionId: number | null;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime: Date | null;

  @Column({ type: 'int', nullable: true, comment: 'Duration in seconds' })
  duration: number | null;

  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.STARTING })
  status: SessionStatus;

  @Column({ name: 'energy_delivered_kwh', type: 'decimal', precision: 10, scale: 4, default: 0 })
  energyDeliveredKwh: number;

  @Column({ name: 'max_power_kw', type: 'decimal', precision: 8, scale: 2, nullable: true })
  maxPowerKw: number | null;

  @Column({ name: 'average_power_kw', type: 'decimal', precision: 8, scale: 2, nullable: true })
  averagePowerKw: number | null;

  @Column({ name: 'start_soc', type: 'smallint', nullable: true, comment: 'State of charge % at start' })
  startSoc: number | null;

  @Column({ name: 'end_soc', type: 'smallint', nullable: true, comment: 'State of charge % at end' })
  endSoc: number | null;

  @Column({ name: 'tariff_id', type: 'uuid', nullable: true })
  tariffId: string | null;

  @Column({ name: 'price_per_kwh', type: 'decimal', precision: 8, scale: 4, nullable: true })
  pricePerKwh: number | null;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ name: 'payment_status', type: 'varchar', length: 50, nullable: true })
  paymentStatus: string | null;

  @Column({ name: 'stop_reason', type: 'enum', enum: StopReason, nullable: true })
  stopReason: StopReason | null;

  @Column({ name: 'error_code', type: 'varchar', length: 100, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_info', type: 'text', nullable: true })
  errorInfo: string | null;

  @Column({ name: 'meter_start', type: 'int', nullable: true, comment: 'Wh reading at start' })
  meterStart: number | null;

  @Column({ name: 'meter_stop', type: 'int', nullable: true, comment: 'Wh reading at stop' })
  meterStop: number | null;

  @Column({ name: 'id_tag', type: 'varchar', length: 100, nullable: true })
  idTag: string | null;

  @Column({ name: 'fleet_account_id', type: 'uuid', nullable: true })
  fleetAccountId: string | null;

  @ManyToOne(() => UserEntity, (user) => user.chargingSessions)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => VehicleEntity, (vehicle) => vehicle.chargingSessions, { nullable: true })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: VehicleEntity | null;

  @ManyToOne(() => StationEntity, (station) => station.sessions)
  @JoinColumn({ name: 'station_id' })
  station: StationEntity;

  @ManyToOne(() => ChargerEntity, (charger) => charger.sessions)
  @JoinColumn({ name: 'charger_id' })
  charger: ChargerEntity;

  @ManyToOne(() => ConnectorEntity, { nullable: true })
  @JoinColumn({ name: 'connector_id' })
  connector: ConnectorEntity | null;

  @OneToMany(() => MeterValueEntity, (mv) => mv.session)
  meterValues: MeterValueEntity[];

  @ManyToOne(() => PaymentEntity, { nullable: true })
  @JoinColumn({ name: 'payment_id' })
  payment: PaymentEntity | null;
}
