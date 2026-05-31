import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  UPI = 'upi',
  CARD = 'card',
  NETBANKING = 'netbanking',
  WALLET = 'wallet',
  CORPORATE = 'corporate',
  EMI = 'emi',
}

export enum PaymentGateway {
  RAZORPAY = 'razorpay',
  STRIPE = 'stripe',
  INTERNAL_WALLET = 'internal_wallet',
}

export enum PaymentType {
  CHARGING_SESSION = 'charging_session',
  WALLET_TOPUP = 'wallet_topup',
  MEMBERSHIP = 'membership',
  FLEET_BILLING = 'fleet_billing',
  CAFE_ORDER = 'cafe_order',
  WATER_SALE = 'water_sale',
}

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ default: 'INR' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentType })
  type: PaymentType;

  @Index()
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'enum', enum: PaymentMethod, name: 'payment_method' })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentGateway })
  gateway: PaymentGateway;

  @Column({ name: 'gateway_order_id', nullable: true })
  gatewayOrderId?: string;

  @Column({ name: 'gateway_payment_id', nullable: true })
  gatewayPaymentId?: string;

  @Column({ name: 'gateway_signature', nullable: true })
  gatewaySignature?: string;

  @Column({ name: 'invoice_id', nullable: true })
  invoiceId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'failure_reason', nullable: true })
  failureReason?: string;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  refundAmount?: number;

  @Column({ name: 'refunded_at', type: 'timestamp', nullable: true })
  refundedAt?: Date;

  @Column({ name: 'razorpay_refund_id', nullable: true })
  razorpayRefundId?: string;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'description', nullable: true })
  description?: string;

  @Column({ name: 'fleet_account_id', nullable: true })
  fleetAccountId?: string;
}
