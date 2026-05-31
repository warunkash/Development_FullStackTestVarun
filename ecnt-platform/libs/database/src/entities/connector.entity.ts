import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ChargerEntity } from './charger.entity';

export enum ConnectorStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  FAULTED = 'faulted',
  UNAVAILABLE = 'unavailable',
}

@Entity('connectors')
@Index(['chargerId'])
@Index(['chargerId', 'connectorId'], { unique: true })
export class ConnectorEntity extends BaseEntity {
  @Column({ name: 'charger_id', type: 'uuid' })
  chargerId: string;

  @Column({ name: 'connector_id', type: 'smallint' })
  connectorId: number;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ name: 'max_power_kw', type: 'decimal', precision: 8, scale: 2, nullable: true })
  maxPowerKw: number | null;

  @Column({ type: 'enum', enum: ConnectorStatus, default: ConnectorStatus.UNAVAILABLE })
  status: ConnectorStatus;

  @Column({ name: 'total_energy_delivered_kwh', type: 'decimal', precision: 14, scale: 3, default: 0 })
  totalEnergyDeliveredKwh: number;

  @Column({ name: 'total_session_count', type: 'int', default: 0 })
  totalSessionCount: number;

  @ManyToOne(() => ChargerEntity, (charger) => charger.connectors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'charger_id' })
  charger: ChargerEntity;
}
