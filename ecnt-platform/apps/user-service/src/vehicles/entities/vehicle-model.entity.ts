import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Vehicle } from './vehicle.entity';

export enum ConnectorType {
  TYPE2 = 'Type2',
  CCS2 = 'CCS2',
  CHAdeMO = 'CHAdeMO',
  GB_T = 'GB/T',
  BHARAT_AC = 'Bharat AC-001',
  BHARAT_DC = 'Bharat DC-001',
}

@Entity('vehicle_models')
export class VehicleModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  brand: string;

  @Column()
  model: string;

  @Column({ nullable: true })
  variant: string;

  @Column({ name: 'battery_capacity_kwh', type: 'decimal', precision: 6, scale: 2 })
  batteryCapacityKwh: number;

  @Column({ name: 'range_km', nullable: true })
  rangeKm: number;

  @Column({
    name: 'connector_types',
    type: 'simple-array',
  })
  connectorTypes: string[];

  @Column({ name: 'max_ac_charging_kw', type: 'decimal', precision: 6, scale: 2, nullable: true })
  maxAcChargingKw: number;

  @Column({ name: 'max_dc_charging_kw', type: 'decimal', precision: 6, scale: 2, nullable: true })
  maxDcChargingKw: number;

  @Column({ name: 'image_url', nullable: true })
  imageUrl: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => Vehicle, (vehicle) => vehicle.vehicleModel)
  vehicles: Vehicle[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
