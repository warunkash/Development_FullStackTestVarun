import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { FleetAccountEntity } from './fleet-account.entity';
import { FleetVehicleEntity } from '../fleet-vehicles/fleet-vehicle.entity';
import { FleetDriverEntity } from '../fleet-drivers/fleet-driver.entity';
import { FleetBillingRecordEntity } from '../fleet-billing/fleet-billing-record.entity';
import { CreateFleetAccountDto } from './dto/create-fleet-account.dto';
import { UpdateFleetAccountDto } from './dto/update-fleet-account.dto';

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  fleetType?: string;
}

@Injectable()
export class FleetAccountsService {
  private readonly logger = new Logger(FleetAccountsService.name);

  constructor(
    @InjectRepository(FleetAccountEntity)
    private readonly fleetAccountRepo: Repository<FleetAccountEntity>,
    @InjectRepository(FleetVehicleEntity)
    private readonly fleetVehicleRepo: Repository<FleetVehicleEntity>,
    @InjectRepository(FleetDriverEntity)
    private readonly fleetDriverRepo: Repository<FleetDriverEntity>,
    @InjectRepository(FleetBillingRecordEntity)
    private readonly billingRepo: Repository<FleetBillingRecordEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateFleetAccountDto): Promise<FleetAccountEntity> {
    const existing = await this.fleetAccountRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        `Fleet account with email ${dto.email} already exists`,
      );
    }

    if (dto.gstin) {
      const gstinExists = await this.fleetAccountRepo.findOne({
        where: { gstin: dto.gstin },
      });
      if (gstinExists) {
        throw new ConflictException(
          `Fleet account with GSTIN ${dto.gstin} already exists`,
        );
      }
    }

    const account = this.fleetAccountRepo.create({
      ...dto,
      creditLimit: dto.creditLimit ?? 0,
      discountPercent: dto.discountPercent ?? 0,
      currentOutstanding: 0,
      status: 'active',
    });

    const saved = await this.fleetAccountRepo.save(account);
    this.logger.log(
      `Fleet account created: ${saved.id} for ${saved.organizationName}`,
    );
    return saved;
  }

  async findAll(query: PaginationQuery): Promise<{
    data: FleetAccountEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, search, status, fleetType } = query;
    const skip = (page - 1) * limit;

    const qb = this.fleetAccountRepo
      .createQueryBuilder('fa')
      .where('fa.deleted_at IS NULL');

    if (search) {
      qb.andWhere(
        '(fa.organization_name ILIKE :search OR fa.email ILIKE :search OR fa.contact_person_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (status) {
      qb.andWhere('fa.status = :status', { status });
    }
    if (fleetType) {
      qb.andWhere('fa.fleet_type = :fleetType', { fleetType });
    }

    const [data, total] = await qb
      .orderBy('fa.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<FleetAccountEntity> {
    const account = await this.fleetAccountRepo.findOne({
      where: { id },
    });
    if (!account) {
      throw new NotFoundException(`Fleet account ${id} not found`);
    }
    return account;
  }

  async update(
    id: string,
    dto: UpdateFleetAccountDto,
  ): Promise<FleetAccountEntity> {
    const account = await this.findById(id);

    if (dto.email && dto.email !== account.email) {
      const existing = await this.fleetAccountRepo.findOne({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException(
          `Email ${dto.email} already in use by another fleet account`,
        );
      }
    }

    Object.assign(account, dto);
    return this.fleetAccountRepo.save(account);
  }

  async suspend(id: string, reason?: string): Promise<FleetAccountEntity> {
    const account = await this.findById(id);
    if (account.status === 'suspended') {
      throw new BadRequestException('Fleet account is already suspended');
    }
    account.status = 'suspended';
    if (reason) {
      account.notes = `Suspended: ${reason}. Previous notes: ${account.notes || ''}`.trim();
    }
    const updated = await this.fleetAccountRepo.save(account);
    this.logger.log(`Fleet account ${id} suspended. Reason: ${reason}`);
    return updated;
  }

  async activate(id: string): Promise<FleetAccountEntity> {
    const account = await this.findById(id);
    if (account.status === 'active') {
      throw new BadRequestException('Fleet account is already active');
    }
    account.status = 'active';
    return this.fleetAccountRepo.save(account);
  }

  async getDashboard(fleetAccountId: string): Promise<{
    totalVehicles: number;
    activeVehicles: number;
    chargingNow: number;
    monthlySpend: number;
    monthlyKwh: number;
    avgCostPerVehicle: number;
    topVehicles: any[];
    recentSessions: any[];
    outstandingBalance: number;
  }> {
    const account = await this.findById(fleetAccountId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalVehicles = await this.fleetVehicleRepo.count({
      where: { fleetAccountId },
    });

    const activeVehicles = await this.fleetVehicleRepo.count({
      where: { fleetAccountId, status: 'active' },
    });

    const chargingNow = await this.fleetVehicleRepo.count({
      where: { fleetAccountId, chargingStatus: 'charging' },
    });

    const monthlyBilling = await this.billingRepo
      .createQueryBuilder('br')
      .select('SUM(br.amount)', 'totalAmount')
      .addSelect('SUM(br.energy_kwh)', 'totalKwh')
      .where('br.fleet_account_id = :fleetAccountId', { fleetAccountId })
      .andWhere('br.created_at >= :startOfMonth', { startOfMonth })
      .getRawOne();

    const monthlySpend = parseFloat(monthlyBilling?.totalAmount || '0');
    const monthlyKwh = parseFloat(monthlyBilling?.totalKwh || '0');
    const avgCostPerVehicle =
      totalVehicles > 0 ? monthlySpend / totalVehicles : 0;

    const topVehicles = await this.fleetVehicleRepo
      .createQueryBuilder('fv')
      .leftJoin(
        FleetBillingRecordEntity,
        'br',
        'br.fleet_vehicle_id = fv.id AND br.created_at >= :startOfMonth',
        { startOfMonth },
      )
      .select('fv.id', 'id')
      .addSelect('fv.vehicle_registration', 'vehicleRegistration')
      .addSelect('fv.vehicle_model', 'vehicleModel')
      .addSelect('SUM(br.amount)', 'totalSpend')
      .addSelect('SUM(br.energy_kwh)', 'totalKwh')
      .where('fv.fleet_account_id = :fleetAccountId', { fleetAccountId })
      .groupBy('fv.id')
      .orderBy('SUM(br.amount)', 'DESC')
      .limit(5)
      .getRawMany();

    const recentSessions = await this.billingRepo
      .createQueryBuilder('br')
      .where('br.fleet_account_id = :fleetAccountId', { fleetAccountId })
      .orderBy('br.created_at', 'DESC')
      .limit(10)
      .getMany();

    return {
      totalVehicles,
      activeVehicles,
      chargingNow,
      monthlySpend,
      monthlyKwh,
      avgCostPerVehicle: Math.round(avgCostPerVehicle * 100) / 100,
      topVehicles,
      recentSessions,
      outstandingBalance: Number(account.currentOutstanding),
    };
  }

  async getChargingReport(
    fleetAccountId: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    summary: any;
    byVehicle: any[];
    byDriver: any[];
    byStation: any[];
    dailyBreakdown: any[];
  }> {
    await this.findById(fleetAccountId);

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const sessions = await this.billingRepo
      .createQueryBuilder('br')
      .where('br.fleet_account_id = :fleetAccountId', { fleetAccountId })
      .andWhere('br.created_at BETWEEN :start AND :end', { start, end })
      .getMany();

    const totalAmount = sessions.reduce(
      (sum, s) => sum + Number(s.amount),
      0,
    );
    const totalKwh = sessions.reduce(
      (sum, s) => sum + Number(s.energyKwh),
      0,
    );
    const totalSessions = sessions.length;

    const byVehicle = await this.billingRepo
      .createQueryBuilder('br')
      .leftJoin(FleetVehicleEntity, 'fv', 'fv.id = br.fleet_vehicle_id')
      .select('fv.vehicle_registration', 'vehicleRegistration')
      .addSelect('fv.vehicle_model', 'vehicleModel')
      .addSelect('COUNT(br.id)', 'sessions')
      .addSelect('SUM(br.energy_kwh)', 'totalKwh')
      .addSelect('SUM(br.amount)', 'totalAmount')
      .where('br.fleet_account_id = :fleetAccountId', { fleetAccountId })
      .andWhere('br.created_at BETWEEN :start AND :end', { start, end })
      .groupBy('fv.id')
      .addGroupBy('fv.vehicle_registration')
      .addGroupBy('fv.vehicle_model')
      .orderBy('SUM(br.amount)', 'DESC')
      .getRawMany();

    const byDriver = await this.billingRepo
      .createQueryBuilder('br')
      .leftJoin(FleetDriverEntity, 'fd', 'fd.id = br.fleet_driver_id')
      .select('fd.name', 'driverName')
      .addSelect('fd.license_number', 'licenseNumber')
      .addSelect('COUNT(br.id)', 'sessions')
      .addSelect('SUM(br.energy_kwh)', 'totalKwh')
      .addSelect('SUM(br.amount)', 'totalAmount')
      .where('br.fleet_account_id = :fleetAccountId', { fleetAccountId })
      .andWhere('br.created_at BETWEEN :start AND :end', { start, end })
      .andWhere('br.fleet_driver_id IS NOT NULL')
      .groupBy('fd.id')
      .addGroupBy('fd.name')
      .addGroupBy('fd.license_number')
      .orderBy('SUM(br.amount)', 'DESC')
      .getRawMany();

    const byStation = await this.billingRepo
      .createQueryBuilder('br')
      .select('br.station_id', 'stationId')
      .addSelect('br.station_name', 'stationName')
      .addSelect('COUNT(br.id)', 'sessions')
      .addSelect('SUM(br.energy_kwh)', 'totalKwh')
      .addSelect('SUM(br.amount)', 'totalAmount')
      .where('br.fleet_account_id = :fleetAccountId', { fleetAccountId })
      .andWhere('br.created_at BETWEEN :start AND :end', { start, end })
      .groupBy('br.station_id')
      .addGroupBy('br.station_name')
      .orderBy('SUM(br.amount)', 'DESC')
      .getRawMany();

    const dailyBreakdown = await this.billingRepo
      .createQueryBuilder('br')
      .select("DATE(br.created_at)", 'date')
      .addSelect('COUNT(br.id)', 'sessions')
      .addSelect('SUM(br.energy_kwh)', 'totalKwh')
      .addSelect('SUM(br.amount)', 'totalAmount')
      .where('br.fleet_account_id = :fleetAccountId', { fleetAccountId })
      .andWhere('br.created_at BETWEEN :start AND :end', { start, end })
      .groupBy("DATE(br.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      summary: {
        totalSessions,
        totalKwh: Math.round(totalKwh * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        avgKwhPerSession:
          totalSessions > 0
            ? Math.round((totalKwh / totalSessions) * 100) / 100
            : 0,
        avgCostPerSession:
          totalSessions > 0
            ? Math.round((totalAmount / totalSessions) * 100) / 100
            : 0,
        startDate,
        endDate,
      },
      byVehicle,
      byDriver,
      byStation,
      dailyBreakdown,
    };
  }

  async updateOutstanding(
    fleetAccountId: string,
    amount: number,
  ): Promise<FleetAccountEntity> {
    const account = await this.findById(fleetAccountId);
    const newOutstanding = Number(account.currentOutstanding) + amount;

    if (newOutstanding < 0) {
      throw new BadRequestException(
        `Cannot reduce outstanding below 0. Current: ${account.currentOutstanding}, Requested: ${amount}`,
      );
    }

    if (newOutstanding > Number(account.creditLimit)) {
      this.logger.warn(
        `Fleet account ${fleetAccountId} exceeding credit limit. Outstanding: ${newOutstanding}, Limit: ${account.creditLimit}`,
      );
    }

    account.currentOutstanding = newOutstanding;
    return this.fleetAccountRepo.save(account);
  }
}
