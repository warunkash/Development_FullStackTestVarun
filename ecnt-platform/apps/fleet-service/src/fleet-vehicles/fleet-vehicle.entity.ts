import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('fleet_vehicles')
export class FleetVehicleEntity extends BaseEntity {
  @Index()
  @Column({ name: 'fleet_account_id' })
  fleetAccountId: string;

  @Index()
  @Column({ name: 'vehicle_id' })
  vehicleId: string;

  @Column({ name: 'vehicle_registration' })
  vehicleRegistration: string;

  @Column({ name: 'vehicle_model', nullable: true })
  vehicleModel?: string;

  @Column({ name: 'vehicle_name', nullable: true })
  vehicleName?: string;

  @Index()
  @Column({ name: 'assigned_driver_id', nullable: true })
  assignedDriverId?: string;

  @Index()
  @Column({ default: 'active' })
  status: string;

  @Column({ name: 'charging_status', default: 'idle' })
  chargingStatus: string;

  @Column({ name: 'total_kwh_consumed', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalKwhConsumed: number;

  @Column({ name: 'total_sessions', type: 'int', default: 0 })
  totalSessions: number;

  @Column({ name: 'total_spend', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalSpend: number;

  @Column({ name: 'added_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  addedAt: Date;
}
