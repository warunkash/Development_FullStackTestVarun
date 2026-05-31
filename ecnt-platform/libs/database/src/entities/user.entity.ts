import {
  Entity,
  Column,
  Index,
  OneToMany,
  OneToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { RoleEntity } from './role.entity';
import { VehicleEntity } from './vehicle.entity';
import { WalletEntity } from './wallet.entity';
import { MembershipEntity } from './membership.entity';
import { ChargingSessionEntity } from './charging-session.entity';
import { NotificationEntity } from './notification.entity';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

@Entity('users')
@Index(['email'], { unique: true, where: '"deleted_at" IS NULL' })
@Index(['phone'], { unique: true, where: '"deleted_at" IS NULL' })
@Index(['status'])
@Index(['createdAt'])
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  @Index()
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
  })
  status: UserStatus;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ name: 'phone_verified', type: 'boolean', default: false })
  phoneVerified: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'last_login_ip', type: 'varchar', length: 45, nullable: true })
  lastLoginIp: string | null;

  @Column({ name: 'profile_image_url', type: 'varchar', length: 1000, nullable: true })
  profileImageUrl: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ name: 'referral_code', type: 'varchar', length: 20, nullable: true, unique: true })
  referralCode: string | null;

  @Column({ name: 'referred_by_id', type: 'uuid', nullable: true })
  referredById: string | null;

  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @ManyToMany(() => RoleEntity, (role) => role.users, { eager: false })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: RoleEntity[];

  @OneToMany(() => VehicleEntity, (vehicle) => vehicle.user)
  vehicles: VehicleEntity[];

  @OneToOne(() => WalletEntity, (wallet) => wallet.user)
  wallet: WalletEntity;

  @OneToMany(() => MembershipEntity, (membership) => membership.user)
  memberships: MembershipEntity[];

  @OneToMany(() => ChargingSessionEntity, (session) => session.user)
  chargingSessions: ChargingSessionEntity[];

  @OneToMany(() => NotificationEntity, (notification) => notification.user)
  notifications: NotificationEntity[];
}
