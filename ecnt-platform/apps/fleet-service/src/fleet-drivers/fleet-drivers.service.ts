import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FleetDriverEntity } from './fleet-driver.entity';
import { FleetBillingRecordEntity } from '../fleet-billing/fleet-billing-record.entity';

export interface AddDriverDto {
  name: string;
  licenseNumber: string;
  phone: string;
  email?: string;
  licenseExpiry?: string;
  employeeId?: string;
  notes?: string;
}

export interface UpdateDriverDto extends Partial<AddDriverDto> {}

@Injectable()
export class FleetDriversService {
  private readonly logger = new Logger(FleetDriversService.name);

  constructor(
    @InjectRepository(FleetDriverEntity)
    private readonly fleetDriverRepo: Repository<FleetDriverEntity>,
    @InjectRepository(FleetBillingRecordEntity)
    private readonly billingRepo: Repository<FleetBillingRecordEntity>,
  ) {}

  async addDriver(
    fleetAccountId: string,
    dto: AddDriverDto,
  ): Promise<FleetDriverEntity> {
    const existing = await this.fleetDriverRepo.findOne({
      where: { licenseNumber: dto.licenseNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Driver with license number ${dto.licenseNumber} already exists`,
      );
    }

    const driver = this.fleetDriverRepo.create({
      fleetAccountId,
      name: dto.name,
      licenseNumber: dto.licenseNumber,
      phone: dto.phone,
      email: dto.email,
      licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : undefined,
      employeeId: dto.employeeId,
      notes: dto.notes,
      status: 'active',
    });

    const saved = await this.fleetDriverRepo.save(driver);
    this.logger.log(
      `Driver ${dto.name} (${dto.licenseNumber}) added to fleet ${fleetAccountId}`,
    );
    return saved;
  }

  async getFleetDrivers(fleetAccountId: string): Promise<{
    drivers: FleetDriverEntity[];
    summary: any;
  }> {
    const drivers = await this.fleetDriverRepo.find({
      where: { fleetAccountId },
      order: { createdAt: 'DESC' },
    });

    const summary = {
      total: drivers.length,
      active: drivers.filter((d) => d.status === 'active').length,
      inactive: drivers.filter((d) => d.status === 'inactive').length,
      expiringLicenses: drivers.filter((d) => {
        if (!d.licenseExpiry) return false;
        const expiryDate = new Date(d.licenseExpiry);
        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
        return expiryDate <= thirtyDaysLater;
      }).length,
    };

    return { drivers, summary };
  }

  async findById(id: string): Promise<FleetDriverEntity> {
    const driver = await this.fleetDriverRepo.findOne({ where: { id } });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
    return driver;
  }

  async updateDriver(
    driverId: string,
    dto: UpdateDriverDto,
  ): Promise<FleetDriverEntity> {
    const driver = await this.findById(driverId);

    if (dto.licenseNumber && dto.licenseNumber !== driver.licenseNumber) {
      const existing = await this.fleetDriverRepo.findOne({
        where: { licenseNumber: dto.licenseNumber },
      });
      if (existing) {
        throw new ConflictException(
          `License number ${dto.licenseNumber} already in use`,
        );
      }
    }

    Object.assign(driver, {
      ...dto,
      licenseExpiry: dto.licenseExpiry
        ? new Date(dto.licenseExpiry)
        : driver.licenseExpiry,
    });

    return this.fleetDriverRepo.save(driver);
  }

  async deactivateDriver(driverId: string): Promise<FleetDriverEntity> {
    const driver = await this.findById(driverId);
    if (driver.status === 'inactive') {
      throw new BadRequestException('Driver is already inactive');
    }
    driver.status = 'inactive';
    return this.fleetDriverRepo.save(driver);
  }

  async activateDriver(driverId: string): Promise<FleetDriverEntity> {
    const driver = await this.findById(driverId);
    if (driver.status === 'active') {
      throw new BadRequestException('Driver is already active');
    }
    driver.status = 'active';
    return this.fleetDriverRepo.save(driver);
  }

  async getDriverStats(
    driverId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month',
  ): Promise<{
    driver: FleetDriverEntity;
    stats: any;
    sessions: any[];
  }> {
    const driver = await this.findById(driverId);

    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const sessions = await this.billingRepo
      .createQueryBuilder('br')
      .where('br.fleet_driver_id = :driverId', { driverId })
      .andWhere('br.created_at >= :startDate', { startDate })
      .orderBy('br.created_at', 'DESC')
      .getMany();

    const totalAmount = sessions.reduce((sum, s) => sum + Number(s.amount), 0);
    const totalKwh = sessions.reduce(
      (sum, s) => sum + Number(s.energyKwh),
      0,
    );

    const stats = {
      totalSessions: sessions.length,
      totalKwh: Math.round(totalKwh * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      avgKwhPerSession:
        sessions.length > 0
          ? Math.round((totalKwh / sessions.length) * 100) / 100
          : 0,
      avgCostPerSession:
        sessions.length > 0
          ? Math.round((totalAmount / sessions.length) * 100) / 100
          : 0,
      period,
      startDate,
      endDate: now,
    };

    return { driver, stats, sessions };
  }
}
