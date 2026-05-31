import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FleetBillingRecordEntity } from './fleet-billing-record.entity';
import { FleetAccountEntity } from '../fleet-accounts/fleet-account.entity';

export interface CreateBillingRecordDto {
  fleetAccountId: string;
  fleetVehicleId?: string;
  fleetDriverId?: string;
  sessionId?: string;
  stationId?: string;
  stationName?: string;
  chargerId?: string;
  energyKwh: number;
  amount: number;
  discountAmount?: number;
  sessionStart?: Date;
  sessionEnd?: Date;
  invoiceId?: string;
}

@Injectable()
export class FleetBillingService {
  private readonly logger = new Logger(FleetBillingService.name);

  constructor(
    @InjectRepository(FleetBillingRecordEntity)
    private readonly billingRepo: Repository<FleetBillingRecordEntity>,
    @InjectRepository(FleetAccountEntity)
    private readonly fleetAccountRepo: Repository<FleetAccountEntity>,
  ) {}

  async createBillingRecord(
    dto: CreateBillingRecordDto,
  ): Promise<FleetBillingRecordEntity> {
    const account = await this.fleetAccountRepo.findOne({
      where: { id: dto.fleetAccountId },
    });
    if (!account) {
      throw new NotFoundException(
        `Fleet account ${dto.fleetAccountId} not found`,
      );
    }

    const discountAmount = dto.discountAmount || 0;
    const netAmount = dto.amount - discountAmount;

    const record = this.billingRepo.create({
      ...dto,
      discountAmount,
      netAmount,
      paymentStatus: 'pending',
    });

    const saved = await this.billingRepo.save(record);

    // Update fleet account outstanding
    account.currentOutstanding =
      Number(account.currentOutstanding) + netAmount;
    await this.fleetAccountRepo.save(account);

    this.logger.log(
      `Billing record created for fleet ${dto.fleetAccountId}: ₹${netAmount} (${dto.energyKwh} kWh)`,
    );
    return saved;
  }

  async getFleetBillingRecords(
    fleetAccountId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: FleetBillingRecordEntity[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.billingRepo.findAndCount({
      where: { fleetAccountId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return { data, total };
  }

  async generateMonthlyInvoice(
    fleetAccountId: string,
    year: number,
    month: number,
  ): Promise<{ invoiceId: string; records: FleetBillingRecordEntity[]; total: number; summary: any }> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const records = await this.billingRepo
      .createQueryBuilder('br')
      .where('br.fleet_account_id = :fleetAccountId', { fleetAccountId })
      .andWhere('br.created_at BETWEEN :start AND :end', { start, end })
      .andWhere('br.invoice_id IS NULL')
      .getMany();

    if (records.length === 0) {
      return {
        invoiceId: '',
        records: [],
        total: 0,
        summary: { message: 'No unbilled records for this period' },
      };
    }

    const invoiceId = `INV-${fleetAccountId.substring(0, 8).toUpperCase()}-${year}${String(month).padStart(2, '0')}-${Date.now()}`;
    const totalAmount = records.reduce((sum, r) => sum + Number(r.netAmount), 0);
    const totalKwh = records.reduce((sum, r) => sum + Number(r.energyKwh), 0);

    // Mark records with invoice ID
    await this.billingRepo
      .createQueryBuilder()
      .update(FleetBillingRecordEntity)
      .set({ invoiceId, paymentStatus: 'invoiced' })
      .whereInIds(records.map((r) => r.id))
      .execute();

    return {
      invoiceId,
      records,
      total: Math.round(totalAmount * 100) / 100,
      summary: {
        totalSessions: records.length,
        totalKwh: Math.round(totalKwh * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        period: `${year}-${String(month).padStart(2, '0')}`,
      },
    };
  }

  async markAsPaid(
    invoiceId: string,
    fleetAccountId: string,
  ): Promise<void> {
    const records = await this.billingRepo.find({
      where: { invoiceId, fleetAccountId },
    });

    if (records.length === 0) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const totalPaid = records.reduce((sum, r) => sum + Number(r.netAmount), 0);

    await this.billingRepo
      .createQueryBuilder()
      .update(FleetBillingRecordEntity)
      .set({ paymentStatus: 'paid' })
      .where('invoice_id = :invoiceId AND fleet_account_id = :fleetAccountId', {
        invoiceId,
        fleetAccountId,
      })
      .execute();

    const account = await this.fleetAccountRepo.findOne({
      where: { id: fleetAccountId },
    });
    if (account) {
      account.currentOutstanding = Math.max(
        0,
        Number(account.currentOutstanding) - totalPaid,
      );
      await this.fleetAccountRepo.save(account);
    }

    this.logger.log(
      `Invoice ${invoiceId} marked as paid. Amount: ₹${totalPaid}`,
    );
  }
}
