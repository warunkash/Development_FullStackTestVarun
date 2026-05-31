import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { StationEntity } from '../stations/station.entity';

export enum ChargerStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  FAULTED = 'faulted',
  OFFLINE = 'offline',
  PREPARING = 'preparing',
  MAINTENANCE = 'maintenance',
}

export enum ChargerType {
  AC_TYPE1 = 'ac_type1',
  AC_TYPE2 = 'ac_type2',
  DC_CCS = 'dc_ccs',
  DC_CHADEMO = 'dc_chademo',
  DC_BHARAT_AC = 'dc_bharat_ac',
  DC_BHARAT_DC = 'dc_bharat_dc',
}

export enum OcppVersion {
  V16 = '1.6',
  V201 = '2.0.1',
}

@Entity('chargers')
@Index(['stationId'])
@Index(['ocppChargePointId'], { unique: true })
@Index(['status'])
export class ChargerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  stationId: string;

  @ManyToOne(() => StationEntity, (station) => station.chargers)
  @JoinColumn({ name: 'stationId' })
  station: StationEntity;

  @Column({ length: 100, unique: true })
  serialNumber: string;

  @Column({ length: 100 })
  model: string;

  @Column({ length: 100 })
  manufacturer: string;

  @Column({
    type: 'enum',
    enum: ChargerType,
  })
  type: ChargerType;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  maxPowerKw: number;

  @Column({ default: 230 })
  voltage: number;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  amperage: number;

  @Column({ length: 100, unique: true })
  ocppChargePointId: string;

  @Column({
    type: 'enum',
    enum: OcppVersion,
    default: OcppVersion.V16,
  })
  ocppVersion: OcppVersion;

  @Column({ default: 1 })
  numberOfConnectors: number;

  @Column({
    type: 'enum',
    enum: ChargerStatus,
    default: ChargerStatus.OFFLINE,
  })
  status: ChargerStatus;

  @Column({ nullable: true, length: 50 })
  firmwareVersion: string;

  @Column({ nullable: true, type: 'timestamp' })
  lastHeartbeatAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  lastBootAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  lastFaultAt: Date;

  @Column({ nullable: true, type: 'text' })
  lastFaultCode: string;

  @Column({ nullable: true, type: 'text' })
  lastFaultInfo: string;

  // Connector status stored as JSONB for multi-connector chargers
  @Column({ type: 'jsonb', nullable: true })
  connectorStatuses: Record<string, { status: string; errorCode?: string; lastUpdated: string }>;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  totalEnergyKwh: number;

  @Column({ default: 0 })
  totalSessions: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalRevenueInr: number;

  @Column({ nullable: true, type: 'text' })
  pendingFirmwareUrl: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
