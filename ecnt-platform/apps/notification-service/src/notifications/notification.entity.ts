import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export enum NotificationChannel {
  PUSH = 'push',
  SMS = 'sms',
  EMAIL = 'email',
  IN_APP = 'in_app',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  READ = 'read',
}

export enum NotificationType {
  CHARGING_STARTED = 'charging_started',
  CHARGING_COMPLETE = 'charging_complete',
  CHARGING_ERROR = 'charging_error',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  PAYMENT_FAILED = 'payment_failed',
  LOW_WALLET = 'low_wallet',
  MAINTENANCE_ALERT = 'maintenance_alert',
  TICKET_CREATED = 'ticket_created',
  OTP = 'otp',
  WELCOME = 'welcome',
  PROMOTION = 'promotion',
  SYSTEM = 'system',
}

@Entity('notifications')
export class NotificationEntity extends BaseEntity {
  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.PUSH,
  })
  channel: NotificationChannel;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any>;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt?: Date;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt?: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'external_id', nullable: true })
  externalId?: string;
}
