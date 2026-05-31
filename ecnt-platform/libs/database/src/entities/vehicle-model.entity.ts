import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { VehicleEntity } from './vehicle.entity';

@Entity('vehicle_models')
@Index(['make', 'model', 'variant', 'year'])
export class VehicleModelEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  make: string;

  @Column({ type: 'varchar', length: 100 })
  model: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  variant: string | null;

  @Column({ type: 'smallint' })
  year: number;

  @Column({ name: 'battery_capacity_kwh', type: 'decimal', precision: 6, scale: 2 })
  batteryCapacityKwh: number;

  @Column({ name: 'usable_capacity_kwh', type: 'decimal', precision: 6, scale: 2, nullable: true })
  usableCapacityKwh: number | null;

  @Column({ name: 'max_ac_charging_kw', type: 'decimal', precision: 6, scale: 2, nullable: true })
  maxAcChargingKw: number | null;

  @Column({ name: 'max_dc_charging_kw', type: 'decimal', precision: 6, scale: 2, nullable: true })
  maxDcChargingKw: number | null;

  @Column({ name: 'range_km', type: 'int', nullable: true })
  rangeKm: number | null;

  @Column({ name: 'connector_types', type: 'varchar', array: true, default: [] })
  connectorTypes: string[];

  @Column({ name: 'image_url', type: 'varchar', length: 1000, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ name: 'segment', type: 'varchar', length: 50, nullable: true })
  segment: string | null;

  @OneToMany(() => VehicleEntity, (vehicle) => vehicle.vehicleModel)
  vehicles: VehicleEntity[];
}
