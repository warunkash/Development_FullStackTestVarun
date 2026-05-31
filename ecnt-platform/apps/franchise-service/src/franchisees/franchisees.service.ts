import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FranchiseeEntity, FranchiseeStatus, ContractType } from './franchisee.entity';
import { FranchiseePaymentEntity, PaymentType } from './franchisee-payment.entity';
import { FranchiseeRevenueRecordEntity } from './franchisee-revenue-record.entity';
import { CreateFranchiseeDto } from './dto/create-franchisee.dto';

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

@Injectable()
export class FranchiseesService {
  private readonly logger = new Logger(FranchiseesService.name);

  constructor(
    @InjectRepository(FranchiseeEntity)
    private readonly franchiseeRepo: Repository<FranchiseeEntity>,
    @InjectRepository(FranchiseePaymentEntity)
    private readonly paymentRepo: Repository<FranchiseePaymentEntity>,
    @InjectRepository(FranchiseeRevenueRecordEntity)
    private readonly revenueRepo: Repository<FranchiseeRevenueRecordEntity>,
  ) {}

  async onboard(dto: CreateFranchiseeDto): Promise<FranchiseeEntity> {
    const existing = await this.franchiseeRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        `Franchisee with email ${dto.email} already exists`,
      );
    }

    const franchisee = this.franchiseeRepo.create({
      ...dto,
      status: FranchiseeStatus.PENDING,
      revenueSharePercent: dto.revenueSharePercent ?? 25,
      fixedMonthlyFee: dto.fixedMonthlyFee ?? 0,
      totalRevenueGenerated: 0,
      totalCommissionPaid: 0,
      pendingCommission: 0,
    });

    const saved = await this.franchiseeRepo.save(franchisee);
    this.logger.log(
      `Franchisee onboarded: ${saved.id} - ${saved.organizationName}`,
    );
    return saved;
  }

  async findAll(query: PaginationQuery): Promise<{
    data: FranchiseeEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, search, status } = query;
    const skip = (page - 1) * limit;

    const qb = this.franchiseeRepo
      .createQueryBuilder('f')
      .where('f.deleted_at IS NULL');

    if (search) {
      qb.andWhere(
        '(f.organization_name ILIKE :search OR f.owner_name ILIKE :search OR f.email ILIKE :search OR f.city ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (status) {
      qb.andWhere('f.status = :status', { status });
    }

    const [data, total] = await qb
      .orderBy('f.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<FranchiseeEntity> {
    const franchisee = await this.franchiseeRepo.findOne({ where: { id } });
    if (!franchisee) {
      throw new NotFoundException(`Franchisee ${id} not found`);
    }
    return franchisee;
  }

  async update(
    id: string,
    dto: Partial<CreateFranchiseeDto>,
  ): Promise<FranchiseeEntity> {
    const franchisee = await this.findById(id);

    if (dto.email && dto.email !== franchisee.email) {
      const existing = await this.franchiseeRepo.findOne({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException(
          `Email ${dto.email} already in use by another franchisee`,
        );
      }
    }

    Object.assign(franchisee, dto);
    return this.franchiseeRepo.save(franchisee);
  }

  async getDashboard(franchiseeId: string): Promise<{
    franchisee: FranchiseeEntity;
    stations: any[];
    monthlyRevenue: number;
    franchiseeShare: number;
    pendingPayments: number;
    activeChargers: number;
    faultedChargers: number;
    topPerformingStation: any;
    recentAlerts: any[];
  }> {
    const franchisee = await this.findById(franchiseeId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Monthly revenue aggregation
    const monthlyRevData = await this.revenueRepo
      .createQueryBuilder('rr')
      .select('SUM(rr.gross_revenue)', 'totalRevenue')
      .addSelect('SUM(rr.franchisee_share)', 'totalShare')
      .where('rr.franchisee_id = :franchiseeId', { franchiseeId })
      .andWhere('rr.created_at >= :startOfMonth', { startOfMonth })
      .getRawOne();

    const monthlyRevenue = parseFloat(monthlyRevData?.totalRevenue || '0');
    const franchiseeShare = parseFloat(monthlyRevData?.totalShare || '0');

    // Station-level aggregation for this month
    const stations = await this.revenueRepo
      .createQueryBuilder('rr')
      .select('rr.station_id', 'stationId')
      .addSelect('rr.station_name', 'stationName')
      .addSelect('COUNT(rr.id)', 'sessionCount')
      .addSelect('SUM(rr.gross_revenue)', 'revenue')
      .addSelect('SUM(rr.franchisee_share)', 'share')
      .addSelect('SUM(rr.energy_kwh)', 'energyKwh')
      .where('rr.franchisee_id = :franchiseeId', { franchiseeId })
      .andWhere('rr.created_at >= :startOfMonth', { startOfMonth })
      .groupBy('rr.station_id')
      .addGroupBy('rr.station_name')
      .orderBy('SUM(rr.gross_revenue)', 'DESC')
      .getRawMany();

    const topPerformingStation = stations.length > 0 ? stations[0] : null;

    // Mock charger health — in production, this would query the OCPP/charging service
    const activeChargers = stations.length * 2;
    const faultedChargers = 0;

    // Pending payments from payment records
    const pendingData = await this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'pending')
      .where('p.franchisee_id = :franchiseeId', { franchiseeId })
      .andWhere('p.status = :status', { status: 'pending' })
      .getRawOne();
    const pendingPayments = parseFloat(pendingData?.pending || '0');

    // Recent alerts: unsettled revenue records older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentAlerts = await this.revenueRepo
      .createQueryBuilder('rr')
      .where('rr.franchisee_id = :franchiseeId', { franchiseeId })
      .andWhere('rr.settled = false')
      .andWhere('rr.created_at < :thirtyDaysAgo', { thirtyDaysAgo })
      .orderBy('rr.created_at', 'DESC')
      .limit(5)
      .getMany()
      .then((records) =>
        records.map((r) => ({
          type: 'unsettled_revenue',
          message: `Unsettled revenue of ₹${r.franchiseeShare} from station ${r.stationName}`,
          date: r.createdAt,
          amount: r.franchiseeShare,
        })),
      );

    return {
      franchisee,
      stations,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      franchiseeShare: Math.round(franchiseeShare * 100) / 100,
      pendingPayments: Math.round(pendingPayments * 100) / 100,
      activeChargers,
      faultedChargers,
      topPerformingStation,
      recentAlerts,
    };
  }

  async getRevenueSplit(
    franchiseeId: string,
    period: 'month' | 'quarter' | 'year' = 'month',
    year?: number,
    month?: number,
  ): Promise<{
    summary: any;
    byStation: any[];
    byDay: any[];
    settlements: any[];
  }> {
    await this.findById(franchiseeId);

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    const y = year || now.getFullYear();
    const m = month || now.getMonth() + 1;

    switch (period) {
      case 'month':
        startDate = new Date(y, m - 1, 1);
        endDate = new Date(y, m, 0, 23, 59, 59);
        break;
      case 'quarter':
        const quarter = Math.floor((m - 1) / 3);
        startDate = new Date(y, quarter * 3, 1);
        endDate = new Date(y, quarter * 3 + 3, 0, 23, 59, 59);
        break;
      case 'year':
        startDate = new Date(y, 0, 1);
        endDate = new Date(y, 11, 31, 23, 59, 59);
        break;
    }

    const totalData = await this.revenueRepo
      .createQueryBuilder('rr')
      .select('SUM(rr.gross_revenue)', 'grossRevenue')
      .addSelect('SUM(rr.franchisee_share)', 'franchiseeShare')
      .addSelect('SUM(rr.platform_share)', 'platformShare')
      .addSelect('SUM(rr.energy_kwh)', 'totalKwh')
      .addSelect('COUNT(rr.id)', 'totalSessions')
      .where('rr.franchisee_id = :franchiseeId', { franchiseeId })
      .andWhere('rr.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();

    const byStation = await this.revenueRepo
      .createQueryBuilder('rr')
      .select('rr.station_id', 'stationId')
      .addSelect('rr.station_name', 'stationName')
      .addSelect('COUNT(rr.id)', 'sessions')
      .addSelect('SUM(rr.gross_revenue)', 'grossRevenue')
      .addSelect('SUM(rr.franchisee_share)', 'franchiseeShare')
      .addSelect('SUM(rr.energy_kwh)', 'energyKwh')
      .where('rr.franchisee_id = :franchiseeId', { franchiseeId })
      .andWhere('rr.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('rr.station_id')
      .addGroupBy('rr.station_name')
      .orderBy('SUM(rr.gross_revenue)', 'DESC')
      .getRawMany();

    const byDay = await this.revenueRepo
      .createQueryBuilder('rr')
      .select("DATE(rr.created_at)", 'date')
      .addSelect('COUNT(rr.id)', 'sessions')
      .addSelect('SUM(rr.gross_revenue)', 'grossRevenue')
      .addSelect('SUM(rr.franchisee_share)', 'franchiseeShare')
      .where('rr.franchisee_id = :franchiseeId', { franchiseeId })
      .andWhere('rr.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy("DATE(rr.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    const settlements = await this.paymentRepo.find({
      where: { franchiseeId, paymentType: PaymentType.COMMISSION },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      summary: {
        grossRevenue: parseFloat(totalData?.grossRevenue || '0'),
        franchiseeShare: parseFloat(totalData?.franchiseeShare || '0'),
        platformShare: parseFloat(totalData?.platformShare || '0'),
        totalKwh: parseFloat(totalData?.totalKwh || '0'),
        totalSessions: parseInt(totalData?.totalSessions || '0'),
        period,
        startDate,
        endDate,
      },
      byStation,
      byDay,
      settlements,
    };
  }

  async processCommission(
    franchiseeId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<{ payment: FranchiseePaymentEntity; totalCommission: number }> {
    const franchisee = await this.findById(franchiseeId);

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    end.setHours(23, 59, 59, 999);

    const unsettledRevenue = await this.revenueRepo
      .createQueryBuilder('rr')
      .select('SUM(rr.franchisee_share)', 'totalCommission')
      .where('rr.franchisee_id = :franchiseeId', { franchiseeId })
      .andWhere('rr.settled = false')
      .andWhere('rr.created_at BETWEEN :start AND :end', { start, end })
      .getRawOne();

    const totalCommission = parseFloat(unsettledRevenue?.totalCommission || '0');

    if (totalCommission <= 0) {
      throw new BadRequestException(
        'No unsettled commission found for this period',
      );
    }

    const settlementId = `SET-${franchiseeId.substring(0, 8).toUpperCase()}-${Date.now()}`;

    // Mark revenue records as settled
    await this.revenueRepo
      .createQueryBuilder()
      .update(FranchiseeRevenueRecordEntity)
      .set({ settled: true, settlementId })
      .where(
        'franchisee_id = :franchiseeId AND settled = false AND created_at BETWEEN :start AND :end',
        { franchiseeId, start, end },
      )
      .execute();

    // Create payment record
    const payment = this.paymentRepo.create({
      franchiseeId,
      paymentType: PaymentType.COMMISSION,
      amount: totalCommission,
      referenceId: settlementId,
      paymentDate: new Date(),
      status: 'completed',
      periodStart: start,
      periodEnd: end,
      notes: `Commission settlement for ${periodStart} to ${periodEnd}`,
    });
    const savedPayment = await this.paymentRepo.save(payment);

    // Update franchisee totals
    franchisee.totalCommissionPaid =
      Number(franchisee.totalCommissionPaid) + totalCommission;
    franchisee.pendingCommission = Math.max(
      0,
      Number(franchisee.pendingCommission) - totalCommission,
    );
    await this.franchiseeRepo.save(franchisee);

    this.logger.log(
      `Commission processed for franchisee ${franchiseeId}: ₹${totalCommission} (${settlementId})`,
    );

    return { payment: savedPayment, totalCommission };
  }

  async getStationHealth(franchiseeId: string): Promise<{
    stations: any[];
    summary: { total: number; healthy: number; warning: number; critical: number };
  }> {
    await this.findById(franchiseeId);

    // Aggregate station info from revenue records
    const stationData = await this.revenueRepo
      .createQueryBuilder('rr')
      .select('rr.station_id', 'stationId')
      .addSelect('rr.station_name', 'stationName')
      .addSelect('MAX(rr.created_at)', 'lastActivity')
      .addSelect('COUNT(rr.id)', 'totalSessions')
      .addSelect('SUM(rr.gross_revenue)', 'totalRevenue')
      .where('rr.franchisee_id = :franchiseeId', { franchiseeId })
      .groupBy('rr.station_id')
      .addGroupBy('rr.station_name')
      .getRawMany();

    const now = new Date();
    const stations = stationData.map((s) => {
      const lastActivity = new Date(s.lastActivity);
      const hoursSinceLastActivity =
        (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);

      let health: 'healthy' | 'warning' | 'critical';
      if (hoursSinceLastActivity < 24) {
        health = 'healthy';
      } else if (hoursSinceLastActivity < 72) {
        health = 'warning';
      } else {
        health = 'critical';
      }

      return {
        ...s,
        health,
        hoursSinceLastActivity: Math.round(hoursSinceLastActivity),
        lastActivity,
      };
    });

    const summary = {
      total: stations.length,
      healthy: stations.filter((s) => s.health === 'healthy').length,
      warning: stations.filter((s) => s.health === 'warning').length,
      critical: stations.filter((s) => s.health === 'critical').length,
    };

    return { stations, summary };
  }

  async recordPayment(
    franchiseeId: string,
    amount: number,
    type: PaymentType,
    notes?: string,
  ): Promise<FranchiseePaymentEntity> {
    await this.findById(franchiseeId);

    const payment = this.paymentRepo.create({
      franchiseeId,
      paymentType: type,
      amount,
      paymentDate: new Date(),
      status: 'completed',
      notes,
    });

    const saved = await this.paymentRepo.save(payment);
    this.logger.log(
      `Payment recorded for franchisee ${franchiseeId}: ₹${amount} (${type})`,
    );
    return saved;
  }

  async activate(id: string): Promise<FranchiseeEntity> {
    const franchisee = await this.findById(id);
    franchisee.status = FranchiseeStatus.ACTIVE;
    return this.franchiseeRepo.save(franchisee);
  }

  async suspend(id: string, reason?: string): Promise<FranchiseeEntity> {
    const franchisee = await this.findById(id);
    franchisee.status = FranchiseeStatus.SUSPENDED;
    if (reason) {
      franchisee.notes = `Suspended: ${reason}`;
    }
    return this.franchiseeRepo.save(franchisee);
  }
}
