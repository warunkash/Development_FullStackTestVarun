import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  OVERDUE = 'overdue',
}

@Entity('invoices')
export class InvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Index({ unique: true })
  @Column({ name: 'invoice_number' })
  invoiceNumber: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'payment_id', nullable: true })
  paymentId?: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId?: string;

  @Column({ name: 'fleet_account_id', nullable: true })
  fleetAccountId?: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  // Billing details
  @Column({ name: 'billing_name' })
  billingName: string;

  @Column({ name: 'billing_email' })
  billingEmail: string;

  @Column({ name: 'billing_phone', nullable: true })
  billingPhone?: string;

  @Column({ name: 'billing_address', nullable: true })
  billingAddress?: string;

  @Column({ name: 'gstin', nullable: true })
  gstin?: string;

  // Amounts
  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'subtotal' })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'cgst_amount', default: 0 })
  cgstAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'sgst_amount', default: 0 })
  sgstAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'igst_amount', default: 0 })
  igstAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'discount_amount', default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_amount' })
  totalAmount: number;

  @Column({ default: 'INR' })
  currency: string;

  @Column({ name: 'notes', nullable: true })
  notes?: string;

  @Column({ name: 'due_date', type: 'timestamp', nullable: true })
  dueDate?: Date;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt?: Date;

  @Column({ name: 'pdf_url', nullable: true })
  pdfUrl?: string;

  @OneToMany(() => InvoiceItemEntity, (item) => item.invoice, { cascade: true, eager: true })
  items: InvoiceItemEntity[];
}

@Entity('invoice_items')
export class InvoiceItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Index()
  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: InvoiceEntity;

  @Column()
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 12, scale: 2 })
  totalPrice: number;

  @Column({ name: 'unit', default: 'unit' })
  unit: string;

  @Column({ name: 'hsn_code', nullable: true })
  hsnCode?: string;

  @Column({ name: 'gst_rate', type: 'decimal', precision: 5, scale: 2, default: 5 })
  gstRate: number;
}
