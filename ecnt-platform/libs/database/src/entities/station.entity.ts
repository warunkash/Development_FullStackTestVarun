import { Entity, Column, Index, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ChargerEntity } from './charger.entity';
import { ChargingSessionEntity } from './charging-session.entity';
import { MaintenanceTicketEntity } from './maintenance-ticket.entity';
import { FranchiseeEntity } from './franchisee.entity';

export enum StationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  COMING_SOON = 'coming_soon',
}

@Entity('stations')
@Index(['code'], { unique: true })
@Index(['status'])
@Index(['operatorId'])
@Index(['franchiseeId'])
@Index(['city'])
@Index(['latitude', 'longitude'])
export class StationEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500 })
  address: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Column({ type: 'varchar', length: 10 })
  pincode: string;

  @Column({ type: 'varchar', length: 100, default: 'India' })
  country: string;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  longitude: number;

  @Column({ type: 'enum', enum: StationStatus, default: StationStatus.ACTIVE })
  status: StationStatus;

  @Column({ name: 'operator_id', type: 'uuid', nullable: true })
  operatorId: string | null;

  @Column({ name: 'franchisee_id', type: 'uuid', nullable: true })
  franchiseeId: string | null;

  @Column({ name: 'total_chargers', type: 'int', default: 0 })
  totalChargers: number;

  @Column({ name: 'available_chargers', type: 'int', default: 0 })
  availableChargers: number;

  @Column({ name: 'occupied_chargers', type: 'int', default: 0 })
  occupiedChargers: number;

  @Column({ name: 'faulted_chargers', type: 'int', default: 0 })
  faultedChargers: number;

  @Column({ type: 'varchar', array: true, default: [] })
  amenities: string[];

  @Column({ name: 'has_solar', type: 'boolean', default: false })
  hasSolar: boolean;

  @Column({ name: 'has_battery', type: 'boolean', default: false })
  hasBattery: boolean;

  @Column({ name: 'has_water_plant', type: 'boolean', default: false })
  hasWaterPlant: boolean;

  @Column({ name: 'has_cafe', type: 'boolean', default: false })
  hasCafe: boolean;

  @Column({ name: 'opening_time', type: 'time', nullable: true })
  openingTime: string | null;

  @Column({ name: 'closing_time', type: 'time', nullable: true })
  closingTime: string | null;

  @Column({ name: 'is_24_hours', type: 'boolean', default: false })
  is24Hours: boolean;

  @Column({ name: 'contact_phone', type: 'varchar', length: 20, nullable: true })
  contactPhone: string | null;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail: string | null;

  @Column({ type: 'varchar', array: true, default: [] })
  images: string[];

  @Column({ name: 'total_energy_delivered_kwh', type: 'decimal', precision: 14, scale: 3, default: 0 })
  totalEnergyDeliveredKwh: number;

  @Column({ name: 'total_revenue', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalRevenue: number;

  @Column({ name: 'rating', type: 'decimal', precision: 3, scale: 2, nullable: true })
  rating: number | null;

  @Column({ name: 'rating_count', type: 'int', default: 0 })
  ratingCount: number;

  @OneToMany(() => ChargerEntity, (charger) => charger.station)
  chargers: ChargerEntity[];

  @OneToMany(() => ChargingSessionEntity, (session) => session.station)
  sessions: ChargingSessionEntity[];

  @OneToMany(() => MaintenanceTicketEntity, (ticket) => ticket.station)
  maintenanceTickets: MaintenanceTicketEntity[];

  @ManyToOne(() => FranchiseeEntity, (franchisee) => franchisee.stations, { nullable: true })
  @JoinColumn({ name: 'franchisee_id' })
  franchisee: FranchiseeEntity | null;
}
