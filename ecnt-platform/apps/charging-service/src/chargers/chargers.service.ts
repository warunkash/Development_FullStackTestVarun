import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChargerEntity, ChargerStatus } from './charger.entity';
import { CreateChargerDto, UpdateChargerDto, UpdateChargerStatusDto } from './dto/create-charger.dto';
import { StationsService } from '../stations/stations.service';

export interface ChargerHealthStats {
  total: number;
  available: number;
  occupied: number;
  faulted: number;
  offline: number;
  maintenance: number;
  onlineRate: number;
  faultRate: number;
}

@Injectable()
export class ChargersService {
  private readonly logger = new Logger(ChargersService.name);

  constructor(
    @InjectRepository(ChargerEntity)
    private readonly chargerRepo: Repository<ChargerEntity>,
    private readonly stationsService: StationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async addCharger(stationId: string, dto: CreateChargerDto): Promise<ChargerEntity> {
    this.logger.log(`Adding charger ${dto.serialNumber} to station ${stationId}`);

    // Validate station exists
    await this.stationsService.findById(stationId);

    // Check for duplicate serial / OCPP ID
    const existingSerial = await this.chargerRepo.findOne({ where: { serialNumber: dto.serialNumber } });
    if (existingSerial) {
      throw new ConflictException(`Charger with serial number ${dto.serialNumber} already exists`);
    }

    const existingOcpp = await this.chargerRepo.findOne({ where: { ocppChargePointId: dto.ocppChargePointId } });
    if (existingOcpp) {
      throw new ConflictException(`Charger with OCPP ID ${dto.ocppChargePointId} already exists`);
    }

    const charger = this.chargerRepo.create({
      ...dto,
      stationId,
      status: ChargerStatus.OFFLINE,
      connectorStatuses: this.initConnectorStatuses(dto.numberOfConnectors || 1),
    });

    const saved = await this.chargerRepo.save(charger);

    // Update station charger count
    await this.stationsService.updateAvailability(stationId);

    this.logger.log(`Charger created: ${saved.id}`);
    this.eventEmitter.emit('charger.added', { chargerId: saved.id, stationId });
    return saved;
  }

  private initConnectorStatuses(count: number): Record<string, any> {
    const statuses: Record<string, any> = {};
    for (let i = 1; i <= count; i++) {
      statuses[i.toString()] = { status: 'Unavailable', lastUpdated: new Date().toISOString() };
    }
    return statuses;
  }

  async getStationChargers(stationId: string): Promise<ChargerEntity[]> {
    await this.stationsService.findById(stationId); // validate
    return this.chargerRepo.find({
      where: { stationId, deletedAt: null },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(id: string): Promise<ChargerEntity> {
    const charger = await this.chargerRepo.findOne({ where: { id } });
    if (!charger) {
      throw new NotFoundException(`Charger ${id} not found`);
    }
    return charger;
  }

  async update(id: string, dto: UpdateChargerDto): Promise<ChargerEntity> {
    const charger = await this.findById(id);
    Object.assign(charger, dto);
    return this.chargerRepo.save(charger);
  }

  async remove(id: string): Promise<void> {
    const charger = await this.findById(id);
    await this.chargerRepo.softDelete(id);
    this.logger.log(`Charger ${id} soft-deleted`);
    await this.stationsService.updateAvailability(charger.stationId);
  }

  async updateStatus(
    chargerId: string,
    status: ChargerStatus,
    connectorId?: number,
  ): Promise<ChargerEntity> {
    const charger = await this.findById(chargerId);

    if (connectorId !== undefined) {
      // Update specific connector status
      const connStatuses = charger.connectorStatuses || {};
      connStatuses[connectorId.toString()] = {
        status,
        lastUpdated: new Date().toISOString(),
      };
      charger.connectorStatuses = connStatuses;

      // Derive overall charger status from connectors
      const allStatuses = Object.values(connStatuses).map((c: any) => c.status);
      if (allStatuses.some((s) => s === ChargerStatus.FAULTED)) {
        charger.status = ChargerStatus.FAULTED;
      } else if (allStatuses.some((s) => s === ChargerStatus.OCCUPIED)) {
        charger.status = ChargerStatus.OCCUPIED;
      } else if (allStatuses.every((s) => s === ChargerStatus.AVAILABLE)) {
        charger.status = ChargerStatus.AVAILABLE;
      } else {
        charger.status = status as ChargerStatus;
      }
    } else {
      charger.status = status;
    }

    const updated = await this.chargerRepo.save(charger);
    await this.stationsService.updateAvailability(charger.stationId);

    this.eventEmitter.emit('charger.status.updated', {
      chargerId,
      stationId: charger.stationId,
      status,
      connectorId,
    });

    return updated;
  }

  async updateHeartbeat(chargerId: string): Promise<void> {
    await this.chargerRepo.update(
      { ocppChargePointId: chargerId },
      { lastHeartbeatAt: new Date() },
    );
  }

  async getOfflineChargers(): Promise<ChargerEntity[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.chargerRepo
      .createQueryBuilder('charger')
      .where('charger.isActive = true')
      .andWhere('charger.deletedAt IS NULL')
      .andWhere(
        '(charger.lastHeartbeatAt IS NULL OR charger.lastHeartbeatAt < :threshold)',
        { threshold: fiveMinutesAgo },
      )
      .andWhere('charger.status != :offline', { offline: ChargerStatus.MAINTENANCE })
      .getMany();
  }

  async updateFirmware(chargerId: string, firmwareUrl: string): Promise<void> {
    const charger = await this.findById(chargerId);
    charger.pendingFirmwareUrl = firmwareUrl;
    await this.chargerRepo.save(charger);

    // Emit event so OCPP service can send UpdateFirmware command
    this.eventEmitter.emit('charger.firmware.update.requested', {
      chargerId: charger.id,
      ocppChargePointId: charger.ocppChargePointId,
      firmwareUrl,
      retrieveDate: new Date(Date.now() + 60000).toISOString(), // 1 min from now
    });

    this.logger.log(`Firmware update requested for charger ${chargerId}: ${firmwareUrl}`);
  }

  async getChargerHealth(): Promise<ChargerHealthStats> {
    const stats = await this.chargerRepo
      .createQueryBuilder('charger')
      .select('charger.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('charger.isActive = true')
      .andWhere('charger.deletedAt IS NULL')
      .groupBy('charger.status')
      .getRawMany();

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of stats) {
      counts[row.status] = parseInt(row.count, 10);
      total += parseInt(row.count, 10);
    }

    const offline = counts[ChargerStatus.OFFLINE] || 0;
    const faulted = counts[ChargerStatus.FAULTED] || 0;
    const available = counts[ChargerStatus.AVAILABLE] || 0;
    const occupied = counts[ChargerStatus.OCCUPIED] || 0;
    const maintenance = counts[ChargerStatus.MAINTENANCE] || 0;

    return {
      total,
      available,
      occupied,
      faulted,
      offline,
      maintenance,
      onlineRate: total > 0 ? ((total - offline - faulted) / total) * 100 : 0,
      faultRate: total > 0 ? (faulted / total) * 100 : 0,
    };
  }
}
