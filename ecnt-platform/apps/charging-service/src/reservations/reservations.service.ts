import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReservationEntity, ReservationStatus } from './reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
  reservationId?: string;
}

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    @InjectRepository(ReservationEntity)
    private readonly reservationRepo: Repository<ReservationEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateReservationDto): Promise<ReservationEntity> {
    this.logger.log(`Creating reservation for charger ${dto.chargerId} by user ${dto.userId}`);

    // Validate time range
    const now = new Date();
    if (dto.startTime <= now) {
      throw new BadRequestException('Reservation start time must be in the future');
    }
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException('End time must be after start time');
    }
    const maxAdvanceDays = 7;
    const maxDate = new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);
    if (dto.startTime > maxDate) {
      throw new BadRequestException(`Cannot book more than ${maxAdvanceDays} days in advance`);
    }

    // Check for conflicting reservations
    const conflict = await this.reservationRepo
      .createQueryBuilder('reservation')
      .where('reservation.chargerId = :chargerId', { chargerId: dto.chargerId })
      .andWhere('reservation.connectorId = :connectorId', { connectorId: dto.connectorId })
      .andWhere('reservation.status IN (:...statuses)', {
        statuses: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.ACTIVE],
      })
      .andWhere(
        '(reservation.startTime < :endTime AND reservation.endTime > :startTime)',
        { startTime: dto.startTime, endTime: dto.endTime },
      )
      .getOne();

    if (conflict) {
      throw new ConflictException(
        `Connector is already reserved from ${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}`,
      );
    }

    const reservation = this.reservationRepo.create({
      ...dto,
      status: ReservationStatus.CONFIRMED,
      confirmedAt: new Date(),
    });

    const saved = await this.reservationRepo.save(reservation);
    this.logger.log(`Reservation created: ${saved.id}`);

    this.eventEmitter.emit('reservation.created', {
      reservationId: saved.id,
      userId: dto.userId,
      chargerId: dto.chargerId,
      startTime: dto.startTime,
    });

    return saved;
  }

  async cancel(reservationId: string, userId: string): Promise<ReservationEntity> {
    const reservation = await this.reservationRepo.findOne({ where: { id: reservationId } });
    if (!reservation) {
      throw new NotFoundException(`Reservation ${reservationId} not found`);
    }
    if (reservation.userId !== userId) {
      throw new BadRequestException('You can only cancel your own reservations');
    }
    if (![ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(reservation.status)) {
      throw new BadRequestException(
        `Reservation cannot be cancelled (status: ${reservation.status})`,
      );
    }

    // Check cancellation policy (e.g., no cancellation within 15 minutes of start)
    const minutesUntilStart = (reservation.startTime.getTime() - Date.now()) / 60000;
    if (minutesUntilStart < 15 && minutesUntilStart > 0) {
      this.logger.warn(`Late cancellation for reservation ${reservationId}: ${minutesUntilStart.toFixed(0)} min before start`);
    }

    await this.reservationRepo.update(reservationId, {
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: 'User cancellation',
    });

    const updated = await this.reservationRepo.findOne({ where: { id: reservationId } });

    this.eventEmitter.emit('reservation.cancelled', {
      reservationId,
      userId,
      chargerId: reservation.chargerId,
    });

    return updated;
  }

  async findUserReservations(userId: string): Promise<ReservationEntity[]> {
    return this.reservationRepo.find({
      where: { userId },
      order: { startTime: 'DESC' },
      take: 50,
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkExpiredReservations(): Promise<void> {
    const now = new Date();
    const expiredReservations = await this.reservationRepo
      .createQueryBuilder('reservation')
      .where('reservation.status IN (:...statuses)', {
        statuses: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
      })
      .andWhere('reservation.endTime < :now', { now })
      .getMany();

    if (expiredReservations.length === 0) return;

    this.logger.log(`Expiring ${expiredReservations.length} reservations`);

    await Promise.all(
      expiredReservations.map(async (res) => {
        await this.reservationRepo.update(res.id, { status: ReservationStatus.EXPIRED });
        this.eventEmitter.emit('reservation.expired', {
          reservationId: res.id,
          userId: res.userId,
          chargerId: res.chargerId,
        });
      }),
    );
  }

  async getAvailableSlots(chargerId: string, date: Date): Promise<TimeSlot[]> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    // Get all reservations for this charger on the given date
    const reservations = await this.reservationRepo.find({
      where: {
        chargerId,
        status: ReservationStatus.CONFIRMED,
      },
      order: { startTime: 'ASC' },
    });

    const filteredReservations = reservations.filter(
      (r) => r.startTime < dayEnd && r.endTime > dayStart,
    );

    // Generate 30-minute slots for the day
    const slots: TimeSlot[] = [];
    const slotDurationMs = 30 * 60 * 1000;
    const now = new Date();

    for (let time = dayStart.getTime(); time < dayEnd.getTime(); time += slotDurationMs) {
      const slotStart = new Date(time);
      const slotEnd = new Date(time + slotDurationMs);

      if (slotEnd <= now) continue; // Skip past slots

      const conflictingReservation = filteredReservations.find(
        (r) => r.startTime < slotEnd && r.endTime > slotStart,
      );

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        available: !conflictingReservation,
        reservationId: conflictingReservation?.id,
      });
    }

    return slots;
  }
}
