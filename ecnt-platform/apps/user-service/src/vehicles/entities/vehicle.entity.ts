import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { VehicleModel } from './vehicle-model.entity';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'vehicle_model_id' })
  vehicleModelId: string;

  @Column({ name: 'registration_number', unique: true })
  @Index()
  registrationNumber: string;

  @Column({ nullable: true })
  vin: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  year: number;

  @Column({ name: 'rfid_tag', nullable: true, unique: true })
  rfidTag: string;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => User, (user) => user.vehicles)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => VehicleModel, (model) => model.vehicles, { eager: true })
  @JoinColumn({ name: 'vehicle_model_id' })
  vehicleModel: VehicleModel;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
