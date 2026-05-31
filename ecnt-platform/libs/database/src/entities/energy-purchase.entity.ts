import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { StationEntity } from './station.entity';

export enum EnergyPaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
}

@Entity('energy_purchases')
@Index(['stationId'])
@Index(['purchaseDate'])
export class EnergyPurchaseEntity extends BaseEntity {
  @Column({ name: 'station_id', type: 'uuid' })
  stationId: string;

  @Column({ type: 'varchar', length: 200 })
  supplier: string;

  @Column({ name: 'purchase_date', type: 'date' })
  purchaseDate: Date;

  @Column({ name: 'quantity_kwh', type: 'decimal', precision: 14, scale: 3 })
  quantityKwh: number;

  @Column({ name: 'price_per_kwh', type: 'decimal', precision: 8, scale: 4 })
  pricePerKwh: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ name: 'invoice_number', type: 'varchar', length: 100, nullable: true })
  invoiceNumber: string | null;

  @Column({ name: 'payment_status', type: 'enum', enum: EnergyPaymentStatus, default: EnergyPaymentStatus.PENDING })
  paymentStatus: EnergyPaymentStatus;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => StationEntity)
  @JoinColumn({ name: 'station_id' })
  station: StationEntity;
}
