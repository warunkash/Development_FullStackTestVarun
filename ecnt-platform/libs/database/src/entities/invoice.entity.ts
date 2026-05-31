import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  OVERDUE = 'overdue',
}

export enum InvoiceType {
  CHARGING = 'charging',
  MEMBERSHIP = 'membership',
  FLEET = 'fleet',
  TOPUP = 'topup',
}

@Entity('invoices')
@Index(['userId'])
@Index(['invoiceNumber'], { unique: true })
@Index(['status'])
@Index(['issuedAt'])
export class InvoiceEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50, unique: true })
  invoiceNumber: string;

  @Column({ type: 'enum', enum: InvoiceType })
  type: InvoiceType;

  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issuedAt: Date | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tax: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ name: 'billing_address', type: 'jsonb', nullable: true })
  billingAddress: Record<string, unknown> | null;

  @Column({ type: 'jsonb', default: [] })
  items: Array<Record<string, unknown>>;

  @Column({ name: 'pdf_url', type: 'varchar', length: 1000, nullable: true })
  pdfUrl: string | null;

  @Column({ name: 'fleet_account_id', type: 'uuid', nullable: true })
  fleetAccountId: string | null;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
