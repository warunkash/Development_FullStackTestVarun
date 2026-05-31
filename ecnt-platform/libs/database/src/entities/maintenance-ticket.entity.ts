import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { StationEntity } from './station.entity';
import { ChargerEntity } from './charger.entity';
import { UserEntity } from './user.entity';

export enum TicketCategory {
  ELECTRICAL = 'electrical',
  MECHANICAL = 'mechanical',
  SOFTWARE = 'software',
  NETWORK = 'network',
  VANDALISM = 'vandalism',
  OTHER = 'other',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  WONT_FIX = 'wont_fix',
}

@Entity('maintenance_tickets')
@Index(['stationId'])
@Index(['chargerId'])
@Index(['status'])
@Index(['priority'])
@Index(['assignedToId'])
export class MaintenanceTicketEntity extends BaseEntity {
  @Column({ name: 'station_id', type: 'uuid' })
  stationId: string;

  @Column({ name: 'charger_id', type: 'uuid', nullable: true })
  chargerId: string | null;

  @Column({ name: 'reported_by_id', type: 'uuid', nullable: true })
  reportedById: string | null;

  @Column({ name: 'assigned_to_id', type: 'uuid', nullable: true })
  assignedToId: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: TicketCategory })
  category: TicketCategory;

  @Column({ type: 'enum', enum: TicketPriority, default: TicketPriority.MEDIUM })
  priority: TicketPriority;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.OPEN })
  status: TicketStatus;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @Column({ name: 'time_to_resolve_hours', type: 'decimal', precision: 8, scale: 2, nullable: true })
  timeToResolveHours: number | null;

  @Column({ name: 'spare_parts', type: 'jsonb', default: [] })
  spareParts: Array<Record<string, unknown>>;

  @Column({ name: 'labor_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  laborCost: number;

  @Column({ name: 'parts_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  partsCost: number;

  @Column({ name: 'images', type: 'varchar', array: true, default: [] })
  images: string[];

  @ManyToOne(() => StationEntity, (station) => station.maintenanceTickets)
  @JoinColumn({ name: 'station_id' })
  station: StationEntity;

  @ManyToOne(() => ChargerEntity, { nullable: true })
  @JoinColumn({ name: 'charger_id' })
  charger: ChargerEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'reported_by_id' })
  reportedBy: UserEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo: UserEntity | null;
}
