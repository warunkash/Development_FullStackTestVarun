import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionEntity, MeterValueEntity, SessionStatus, StopReason } from './session.entity';
import { ChargerEntity, ChargerStatus } from '../chargers/charger.entity';
import { StartSessionDto } from './dto/start-session.dto';
import { StopSessionDto } from './dto/stop-session.dto';
import { TariffsService } from '../tariffs/tariffs.service';
import { PaginationDto } from '../stations/dto/station-filter.dto';
import { PaginatedResult } from '../stations/stations.service';

export interface MeterValueInput {
  timestamp: Date;
  energyKwh: number;
  powerKw?: number;
  soc?: number;
  voltage?: number;
  current?: number;
  temperature?: number;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
    @InjectRepository(MeterValueEntity)
    private readonly meterValueRepo: Repository<MeterValueEntity>,
    @InjectRepository(ChargerEntity)
    private readonly chargerRepo: Repository<ChargerEntity>,
    private readonly tariffsService: TariffsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async startSession(dto: StartSessionDto): Promise<SessionEntity> {
    this.logger.log(`Starting session for charger ${dto.chargerId}, connector ${dto.connectorId}`);

    // Validate charger exists and is available
    const charger = await this.chargerRepo.findOne({
      where: { id: dto.chargerId },
      relations: ['station'],
    });
    if (!charger) {
      throw new NotFoundException(`Charger ${dto.chargerId} not found`);
    }
    if (charger.status === ChargerStatus.OCCUPIED) {
      throw new ConflictException(`Charger ${dto.chargerId} connector ${dto.connectorId} is already in use`);
    }
    if (charger.status === ChargerStatus.FAULTED || charger.status === ChargerStatus.OFFLINE) {
      throw new BadRequestException(`Charger ${dto.chargerId} is not available (status: ${charger.status})`);
    }

    // Check user doesn't already have an active session
    if (dto.userId) {
      const activeSession = await this.findActiveSession(dto.userId);
      if (activeSession) {
        throw new ConflictException(`User already has an active session: ${activeSession.sessionId}`);
      }
    }

    // Get applicable tariff
    let tariffId = dto.tariffId;
    if (!tariffId) {
      const tariff = await this.tariffsService.getApplicableTariff(dto.chargerId, new Date());
      tariffId = tariff?.id;
    }

    // Generate session ID
    const now = new Date();
    const sessionId = `TXN_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${Date.now().toString().slice(-6)}`;

    const session = this.sessionRepo.create({
      sessionId,
      userId: dto.userId,
      stationId: charger.stationId,
      chargerId: dto.chargerId,
      connectorId: dto.connectorId,
      vehicleId: dto.vehicleId,
      tariffId,
      reservationId: dto.reservationId,
      rfidTag: dto.rfidTag,
      status: SessionStatus.ACTIVE,
      startTime: now,
      energyDeliveredKwh: 0,
      totalCostInr: 0,
    });

    const saved = await this.sessionRepo.save(session);

    // Mark charger as occupied
    await this.chargerRepo.update(dto.chargerId, { status: ChargerStatus.OCCUPIED });

    this.logger.log(`Session started: ${saved.sessionId}`);
    this.eventEmitter.emit('charging.session.started', {
      sessionId: saved.id,
      chargerId: dto.chargerId,
      stationId: charger.stationId,
      userId: dto.userId,
    });

    return saved;
  }

  async updateSession(
    sessionId: string,
    meterValues: MeterValueInput[],
  ): Promise<SessionEntity> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, status: SessionStatus.ACTIVE } });
    if (!session) {
      throw new NotFoundException(`Active session ${sessionId} not found`);
    }

    if (meterValues.length > 0) {
      const latestMeter = meterValues[meterValues.length - 1];
      await this.sessionRepo.update(sessionId, {
        energyDeliveredKwh: latestMeter.energyKwh,
        finalSoc: latestMeter.soc?.toString(),
      });
      await this.addMeterValues(sessionId, meterValues);
    }

    return this.sessionRepo.findOne({ where: { id: sessionId } });
  }

  async stopSession(sessionId: string, dto: StopSessionDto): Promise<SessionEntity> {
    this.logger.log(`Stopping session ${sessionId}`);

    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException(`Session ${sessionId} is not active (status: ${session.status})`);
    }

    const endTime = new Date();
    const durationSeconds = (endTime.getTime() - session.startTime.getTime()) / 1000;
    const durationMinutes = durationSeconds / 60;

    // Calculate final cost
    let totalCostInr = 0;
    let energyCostInr = 0;
    let timeCostInr = 0;
    let taxAmountInr = 0;

    if (session.tariffId) {
      const costBreakdown = await this.tariffsService.calculateCost(
        session.tariffId,
        session.energyDeliveredKwh,
        durationMinutes,
        session.startTime,
      );
      energyCostInr = costBreakdown.energyCostInr;
      timeCostInr = costBreakdown.timeCostInr;
      taxAmountInr = costBreakdown.taxAmountInr;
      totalCostInr = costBreakdown.totalInr;
    }

    await this.sessionRepo.update(sessionId, {
      status: SessionStatus.COMPLETED,
      endTime,
      durationSeconds,
      stopReason: dto.reason || StopReason.LOCAL,
      meterStop: dto.meterStop,
      totalCostInr,
      energyCostInr,
      timeCostInr,
      taxAmountInr,
    });

    // Mark charger as available
    await this.chargerRepo.update(session.chargerId, { status: ChargerStatus.AVAILABLE });

    const updated = await this.sessionRepo.findOne({ where: { id: sessionId } });

    this.eventEmitter.emit('charging.session.stopped', {
      sessionId,
      energyKwh: session.energyDeliveredKwh,
      durationMinutes,
      totalCostInr,
      userId: session.userId,
      stationId: session.stationId,
      chargerId: session.chargerId,
    });

    return updated;
  }

  async findUserSessions(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<SessionEntity>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await this.sessionRepo.findAndCount({
      where: { userId },
      order: { startTime: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findStationSessions(
    stationId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<SessionEntity>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await this.sessionRepo.findAndCount({
      where: { stationId },
      order: { startTime: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findActiveSession(userId: string): Promise<SessionEntity | null> {
    return this.sessionRepo.findOne({
      where: { userId, status: SessionStatus.ACTIVE },
    });
  }

  async getSessionDetails(sessionId: string): Promise<{ session: SessionEntity; meterValues: MeterValueEntity[] }> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const meterValues = await this.meterValueRepo.find({
      where: { sessionId },
      order: { timestamp: 'ASC' },
    });

    return { session, meterValues };
  }

  async calculateSessionCost(
    energyKwh: number,
    tariffId: string,
    durationMinutes: number,
  ): Promise<{ totalInr: number; energyCostInr: number; timeCostInr: number; taxAmountInr: number }> {
    return this.tariffsService.calculateCost(tariffId, energyKwh, durationMinutes, new Date());
  }

  async addMeterValues(sessionId: string, meterValues: MeterValueInput[]): Promise<void> {
    const entities = meterValues.map((mv) =>
      this.meterValueRepo.create({
        sessionId,
        timestamp: mv.timestamp,
        energyKwh: mv.energyKwh,
        powerKw: mv.powerKw,
        soc: mv.soc,
        voltage: mv.voltage,
        current: mv.current,
        temperature: mv.temperature,
      }),
    );

    await this.meterValueRepo.save(entities);
    this.logger.debug(`Saved ${entities.length} meter values for session ${sessionId}`);
  }
}
