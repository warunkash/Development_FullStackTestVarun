import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentMethod {
  UPI = 'upi',
  CARD = 'card',
  WALLET = 'wallet',
  NETBANKING = 'netbanking',
  CORPORATE = 'corporate',
}

export enum PaymentGateway {
  RAZORPAY = 'razorpay',
  STRIPE = 'stripe',
  INTERNAL_WALLET = 'internal_wallet',
}

export enum PaymentType {
  CHARGING = 'charging',
  WALLET_TOPUP = 'wallet_topup',
  MEMBERSHIP = 'membership',
  FLEET = 'fleet',
}

@Entity('payments')
@Index(['userId'])
@Index(['sessionId'])
@Index(['status'])
@Index(['gatewayOrderId'])
@Index(['gatewayPaymentId'])
@Index(['createdAt'])
export class PaymentEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentType })
  type: PaymentType;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null;

  @Column({ type: 'enum', enum: PaymentGateway, nullable: true })
  gateway: PaymentGateway | null;

  @Column({ name: 'gateway_order_id', type: 'varchar', length: 200, nullable: true })
  gatewayOrderId: string | null;

  @Column({ name: 'gateway_payment_id', type: 'varchar', length: 200, nullable: true })
  gatewayPaymentId: string | null;

  @Column({ name: 'gateway_signature', type: 'varchar', length: 500, nullable: true })
  gatewaySignature: string | null;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  refundAmount: number;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
