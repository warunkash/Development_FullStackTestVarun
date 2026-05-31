import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('push_tokens')
export class PushTokenEntity extends BaseEntity {
  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'fcm_token' })
  fcmToken: string;

  @Column({ nullable: true })
  platform?: string;

  @Column({ name: 'device_id', nullable: true })
  deviceId?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_used', type: 'timestamp', nullable: true })
  lastUsed?: Date;
}
