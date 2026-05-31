import { Entity, Column, Index, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { StationEntity } from './station.entity';
import { ConnectorEntity } from './connector.entity';
import { ChargingSessionEntity } from './charging-session.entity';

export enum ChargerType {
  AC_TYPE1 = 'ac_type1',
  AC_TYPE2 = 'ac_type2',
  DC_CCS = 'dc_ccs',
  DC_CHADEMO = 'dc_chademo',
  DC_BHARAT = 'dc_bharat',
}

export enum ChargerStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  FAULTED = 'faulted',
  OFFLINE = 'offline',
  PREPARING = 'preparing',
  FINISHING = 'finishing',
  UNAVAILABLE = 'unavailable',
}

export enum OcppVersion {
  V16 = '1.6',
  V201 = '2.0.1',
}

@Entity('chargers')
@Index(['stationId'])
@Index(['serialNumber'], { unique: true })
@Index(['status'])
@Index(['ocppChargePointId'])
export class ChargerEntity extends BaseEntity {
  @Column({ name: 'station_id', type: 'uuid' })
  stationId: string;

  @Column({ name: 'serial_number', type: 'varchar', length: 100, unique: true })
  serialNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  manufacturer: string | null;

  @Column({ type: 'enum', enum: ChargerType })
  type: ChargerType;

  @Column({ name: 'max_power_kw', type: 'decimal', precision: 8, scale: 2 })
  maxPowerKw: number;

  @Column({ type: 'int', nullable: true })
  voltage: number | null;

  @Column({ type: 'int', nullable: true })
  amperage: number | null;

  @Column({ type: 'enum', enum: ChargerStatus, default: ChargerStatus.OFFLINE })
  status: ChargerStatus;

  @Column({ name: 'ocpp_charge_point_id', type: 'varchar', length: 100, nullable: true })
  @Index()
  ocppChargePointId: string | null;

  @Column({ name: 'ocpp_version', type: 'enum', enum: OcppVersion, default: OcppVersion.V16 })
  ocppVersion: OcppVersion;

  @Column({ name: 'firmware_version', type: 'varchar', length: 100, nullable: true })
  firmwareVersion: string | null;

  @Column({ name: 'last_heartbeat_at', type: 'timestamptz', nullable: true })
  lastHeartbeatAt: Date | null;

  @Column({ name: 'total_energy_delivered_kwh', type: 'decimal', precision: 14, scale: 3, default: 0 })
  totalEnergyDeliveredKwh: number;

  @Column({ name: 'total_session_count', type: 'int', default: 0 })
  totalSessionCount: number;

  @Column({ name: 'error_code', type: 'varchar', length: 100, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_info', type: 'text', nullable: true })
  errorInfo: string | null;

  @Column({ name: 'connector_count', type: 'int', default: 1 })
  connectorCount: number;

  @ManyToOne(() => StationEntity, (station) => station.chargers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'station_id' })
  station: StationEntity;

  @OneToMany(() => ConnectorEntity, (connector) => connector.charger, { cascade: true })
  connectors: ConnectorEntity[];

  @OneToMany(() => ChargingSessionEntity, (session) => session.charger)
  sessions: ChargingSessionEntity[];
}
