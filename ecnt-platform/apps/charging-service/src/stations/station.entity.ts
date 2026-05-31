import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ChargerEntity } from '../chargers/charger.entity';

export enum StationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  COMING_SOON = 'coming_soon',
}

export enum StationAmenity {
  CAFE = 'cafe',
  WATER = 'water',
  RESTROOM = 'restroom',
  PARKING = 'parking',
  WIFI = 'wifi',
  CCTV = 'cctv',
  SOLAR = 'solar',
  BATTERY_BACKUP = 'battery_backup',
}

@Entity('stations')
@Index(['latitude', 'longitude'])
@Index(['status'])
@Index(['city'])
@Index(['code'], { unique: true })
export class StationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text' })
  address: string;

  @Index()
  @Column({ length: 100 })
  city: string;

  @Column({ length: 100 })
  state: string;

  @Column({ length: 10 })
  pincode: string;

  @Index()
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Index()
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Index()
  @Column({
    type: 'enum',
    enum: StationStatus,
    default: StationStatus.ACTIVE,
  })
  status: StationStatus;

  @Column({ type: 'simple-array', nullable: true })
  amenities: StationAmenity[];

  @Column({ type: 'jsonb', nullable: true })
  images: string[];

  @Column({ default: false })
  is24Hours: boolean;

  @Column({ nullable: true, length: 5 })
  openingTime: string; // HH:MM format

  @Column({ nullable: true, length: 5 })
  closingTime: string; // HH:MM format

  @Column({ nullable: true, length: 20 })
  contactPhone: string;

  @Column({ nullable: true, type: 'uuid' })
  franchiseeId: string;

  // Availability counts (denormalized for fast queries)
  @Column({ default: 0 })
  totalChargers: number;

  @Column({ default: 0 })
  availableChargers: number;

  @Column({ default: 0 })
  occupiedChargers: number;

  @Column({ default: 0 })
  faultedChargers: number;

  @Column({ default: 0 })
  offlineChargers: number;

  // Stats
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalRevenueInr: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  totalEnergyKwh: number;

  @Column({ default: 0 })
  totalSessions: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  averageRating: number;

  @Column({ default: 0 })
  totalRatings: number;

  @Column({ nullable: true, type: 'uuid' })
  ownerId: string;

  @Column({ nullable: true, type: 'jsonb' })
  operatingHours: Record<string, { open: string; close: string; closed: boolean }>;

  @Column({ nullable: true, type: 'jsonb' })
  metadata: Record<string, any>;

  @OneToMany(() => ChargerEntity, (charger) => charger.station)
  chargers: ChargerEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
