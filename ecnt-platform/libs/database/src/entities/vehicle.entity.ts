import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { VehicleModelEntity } from './vehicle-model.entity';
import { ChargingSessionEntity } from './charging-session.entity';

export enum VehicleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SOLD = 'sold',
}

@Entity('vehicles')
@Index(['userId'])
@Index(['registrationNumber'], { unique: true, where: '"deleted_at" IS NULL' })
@Index(['rfidTag'], { where: '"rfid_tag" IS NOT NULL' })
export class VehicleEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'vehicle_model_id', type: 'uuid', nullable: true })
  vehicleModelId: string | null;

  @Column({ name: 'registration_number', type: 'varchar', length: 20 })
  registrationNumber: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  vin: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string | null;

  @Column({ type: 'smallint', nullable: true })
  year: number | null;

  @Column({ name: 'battery_capacity_kwh', type: 'decimal', precision: 6, scale: 2, nullable: true })
  batteryCapacityKwh: number | null;

  @Column({ name: 'max_charging_speed_kw', type: 'decimal', precision: 6, scale: 2, nullable: true })
  maxChargingSpeedKw: number | null;

  @Column({ name: 'rfid_tag', type: 'varchar', length: 100, nullable: true })
  rfidTag: string | null;

  @Column({ name: 'nickname', type: 'varchar', length: 100, nullable: true })
  nickname: string | null;

  @Column({ type: 'enum', enum: VehicleStatus, default: VehicleStatus.ACTIVE })
  status: VehicleStatus;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @ManyToOne(() => UserEntity, (user) => user.vehicles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => VehicleModelEntity, (model) => model.vehicles, { nullable: true })
  @JoinColumn({ name: 'vehicle_model_id' })
  vehicleModel: VehicleModelEntity | null;

  @OneToMany(() => ChargingSessionEntity, (session) => session.vehicle)
  chargingSessions: ChargingSessionEntity[];
}
