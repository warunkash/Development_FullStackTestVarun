import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('fleet_billing_records')
export class FleetBillingRecordEntity extends BaseEntity {
  @Index()
  @Column({ name: 'fleet_account_id' })
  fleetAccountId: string;

  @Index()
  @Column({ name: 'fleet_vehicle_id', nullable: true })
  fleetVehicleId?: string;

  @Index()
  @Column({ name: 'fleet_driver_id', nullable: true })
  fleetDriverId?: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId?: string;

  @Column({ name: 'station_id', nullable: true })
  stationId?: string;

  @Column({ name: 'station_name', nullable: true })
  stationName?: string;

  @Column({ name: 'charger_id', nullable: true })
  chargerId?: string;

  @Column({
    name: 'energy_kwh',
    type: 'decimal',
    precision: 8,
    scale: 3,
    default: 0,
  })
  energyKwh: number;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  amount: number;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  discountAmount: number;

  @Column({
    name: 'net_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  netAmount: number;

  @Column({
    name: 'session_start',
    type: 'timestamp',
    nullable: true,
  })
  sessionStart?: Date;

  @Column({
    name: 'session_end',
    type: 'timestamp',
    nullable: true,
  })
  sessionEnd?: Date;

  @Column({ name: 'invoice_id', nullable: true })
  invoiceId?: string;

  @Column({ name: 'payment_status', default: 'pending' })
  paymentStatus: string;
}
