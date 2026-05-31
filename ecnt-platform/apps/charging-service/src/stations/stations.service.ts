import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StationEntity, StationStatus } from './station.entity';
import { CreateStationDto } from './dto/create-station.dto';
import { UpdateStationDto } from './dto/update-station.dto';
import { StationFilterDto } from './dto/station-filter.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NearbyStation extends StationEntity {
  distanceKm: number;
}

export interface StationStats {
  stationId: string;
  period: string;
  totalSessions: number;
  totalEnergyKwh: number;
  totalRevenueInr: number;
  averageSessionDurationMinutes: number;
  peakHour: number;
  utilizationRate: number;
}

@Injectable()
export class StationsService {
  private readonly logger = new Logger(StationsService.name);

  constructor(
    @InjectRepository(StationEntity)
    private readonly stationRepo: Repository<StationEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateStationDto): Promise<StationEntity> {
    this.logger.log(`Creating station: ${dto.name} [${dto.code}]`);

    // Check for duplicate code
    const existing = await this.stationRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Station with code ${dto.code} already exists`);
    }

    // Validate coordinates are within India bounds
    if (dto.latitude < 6.0 || dto.latitude > 37.0 || dto.longitude < 68.0 || dto.longitude > 98.0) {
      throw new BadRequestException('Coordinates appear to be outside India');
    }

    const station = this.stationRepo.create({
      ...dto,
      status: StationStatus.ACTIVE,
      totalChargers: 0,
      availableChargers: 0,
      occupiedChargers: 0,
      faultedChargers: 0,
      offlineChargers: 0,
    });

    const saved = await this.stationRepo.save(station);
    this.logger.log(`Station created: ${saved.id}`);
    this.eventEmitter.emit('station.created', { stationId: saved.id, name: saved.name });
    return saved;
  }

  async findAll(filter: StationFilterDto): Promise<PaginatedResult<StationEntity>> {
    const { page = 1, limit = 20, city, state, status, amenities, hasAvailable, search, chargerType, pincode } = filter;
    const skip = (page - 1) * limit;

    const qb = this.stationRepo
      .createQueryBuilder('station')
      .leftJoinAndSelect('station.chargers', 'charger')
      .where('station.deletedAt IS NULL');

    if (city) {
      qb.andWhere('LOWER(station.city) = LOWER(:city)', { city });
    }
    if (state) {
      qb.andWhere('LOWER(station.state) = LOWER(:state)', { state });
    }
    if (status) {
      qb.andWhere('station.status = :status', { status });
    }
    if (hasAvailable) {
      qb.andWhere('station.availableChargers > 0');
    }
    if (search) {
      qb.andWhere(
        '(LOWER(station.name) LIKE LOWER(:search) OR LOWER(station.address) LIKE LOWER(:search) OR LOWER(station.code) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }
    if (pincode) {
      qb.andWhere('station.pincode = :pincode', { pincode });
    }
    if (amenities && amenities.length > 0) {
      // Filter stations having ALL requested amenities
      amenities.forEach((amenity, idx) => {
        qb.andWhere(`station.amenities LIKE :amenity${idx}`, { [`amenity${idx}`]: `%${amenity}%` });
      });
    }

    qb.orderBy('station.name', 'ASC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findNearby(lat: number, lng: number, radiusKm: number = 10): Promise<NearbyStation[]> {
    this.logger.debug(`Finding stations near (${lat}, ${lng}) within ${radiusKm}km`);

    // Use PostGIS-compatible Haversine formula via raw SQL for performance
    const results = await this.stationRepo
      .createQueryBuilder('station')
      .addSelect(
        `(
          6371 * acos(
            cos(radians(:lat)) * cos(radians(CAST(station.latitude AS FLOAT)))
            * cos(radians(CAST(station.longitude AS FLOAT)) - radians(:lng))
            + sin(radians(:lat)) * sin(radians(CAST(station.latitude AS FLOAT)))
          )
        )`,
        'distanceKm',
      )
      .where('station.status = :status', { status: StationStatus.ACTIVE })
      .andWhere('station.deletedAt IS NULL')
      .andWhere(
        `(
          6371 * acos(
            cos(radians(:lat)) * cos(radians(CAST(station.latitude AS FLOAT)))
            * cos(radians(CAST(station.longitude AS FLOAT)) - radians(:lng))
            + sin(radians(:lat)) * sin(radians(CAST(station.latitude AS FLOAT)))
          )
        ) <= :radius`,
        { lat, lng, radius: radiusKm },
      )
      .leftJoinAndSelect('station.chargers', 'charger')
      .orderBy('distanceKm', 'ASC')
      .limit(50)
      .getRawAndEntities();

    return results.entities.map((station, idx) => ({
      ...station,
      distanceKm: parseFloat(results.raw[idx]?.distanceKm ?? '0'),
    })) as NearbyStation[];
  }

  async findById(id: string): Promise<StationEntity> {
    const station = await this.stationRepo.findOne({
      where: { id },
      relations: ['chargers'],
    });
    if (!station) {
      throw new NotFoundException(`Station ${id} not found`);
    }
    return station;
  }

  async update(id: string, dto: UpdateStationDto): Promise<StationEntity> {
    const station = await this.findById(id);
    Object.assign(station, dto);
    const updated = await this.stationRepo.save(station);
    this.eventEmitter.emit('station.updated', { stationId: id });
    return updated;
  }

  async delete(id: string): Promise<void> {
    const station = await this.findById(id);
    await this.stationRepo.softDelete(id);
    this.logger.log(`Station soft-deleted: ${id}`);
    this.eventEmitter.emit('station.deleted', { stationId: id });
  }

  async updateAvailability(stationId: string): Promise<void> {
    const station = await this.stationRepo.findOne({
      where: { id: stationId },
      relations: ['chargers'],
    });
    if (!station) return;

    const chargers = station.chargers || [];
    const counts = chargers.reduce(
      (acc, charger) => {
        switch (charger.status) {
          case 'available': acc.available++; break;
          case 'occupied': acc.occupied++; break;
          case 'faulted': acc.faulted++; break;
          case 'offline': acc.offline++; break;
        }
        return acc;
      },
      { available: 0, occupied: 0, faulted: 0, offline: 0 },
    );

    await this.stationRepo.update(stationId, {
      totalChargers: chargers.length,
      availableChargers: counts.available,
      occupiedChargers: counts.occupied,
      faultedChargers: counts.faulted,
      offlineChargers: counts.offline,
    });

    this.logger.debug(`Availability updated for station ${stationId}: ${JSON.stringify(counts)}`);
  }

  async getStationStats(stationId: string, period: string = '30d'): Promise<StationStats> {
    await this.findById(stationId); // validate exists

    const days = parseInt(period.replace('d', ''), 10) || 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const result = await this.stationRepo.manager.query(
      `
      SELECT
        COUNT(s.id) AS total_sessions,
        COALESCE(SUM(s.energy_delivered_kwh), 0) AS total_energy_kwh,
        COALESCE(SUM(s.total_cost_inr), 0) AS total_revenue_inr,
        COALESCE(AVG(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60), 0) AS avg_duration_minutes,
        MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM s.start_time)) AS peak_hour
      FROM sessions s
      WHERE s.station_id = $1
        AND s.start_time >= $2
        AND s.status = 'completed'
        AND s.deleted_at IS NULL
      `,
      [stationId, fromDate],
    );

    const row = result[0] || {};
    const totalSessions = parseInt(row.total_sessions, 10) || 0;
    const totalEnergyKwh = parseFloat(row.total_energy_kwh) || 0;

    // Utilization: occupied time / total possible time across all chargers
    const station = await this.stationRepo.findOne({ where: { id: stationId } });
    const maxChargerHours = (station?.totalChargers || 1) * days * 24;
    const estimatedUsedHours = totalSessions > 0 ? (parseFloat(row.avg_duration_minutes) / 60) * totalSessions : 0;
    const utilizationRate = maxChargerHours > 0 ? (estimatedUsedHours / maxChargerHours) * 100 : 0;

    return {
      stationId,
      period,
      totalSessions,
      totalEnergyKwh,
      totalRevenueInr: parseFloat(row.total_revenue_inr) || 0,
      averageSessionDurationMinutes: parseFloat(row.avg_duration_minutes) || 0,
      peakHour: parseInt(row.peak_hour, 10) || 0,
      utilizationRate: Math.min(utilizationRate, 100),
    };
  }

  async setOperationalStatus(stationId: string, status: StationStatus): Promise<StationEntity> {
    const station = await this.findById(stationId);
    station.status = status;
    const updated = await this.stationRepo.save(station);
    this.logger.log(`Station ${stationId} status changed to ${status}`);
    this.eventEmitter.emit('station.status.changed', { stationId, status });
    return updated;
  }

  async uploadImages(stationId: string, files: Express.Multer.File[]): Promise<StationEntity> {
    const station = await this.findById(stationId);

    // In production, upload to S3 and return URLs
    // For now, store file metadata
    const imageUrls = files.map((file) => {
      const s3Key = `stations/${stationId}/${Date.now()}-${file.originalname}`;
      // TODO: Actual S3 upload: await s3Client.putObject({ Key: s3Key, Body: file.buffer, ContentType: file.mimetype })
      return `https://ecnt-media.s3.ap-south-1.amazonaws.com/${s3Key}`;
    });

    station.images = [...(station.images || []), ...imageUrls];
    return this.stationRepo.save(station);
  }
}
