import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TariffEntity, TariffRuleEntity, TariffType } from './tariff.entity';
import { CreateTariffDto } from './dto/create-tariff.dto';

export interface CostBreakdown {
  energyCostInr: number;
  timeCostInr: number;
  sessionFeeInr: number;
  taxAmountInr: number;
  totalInr: number;
  ratePerKwh: number;
  ratePerMinute: number;
  taxPercentage: number;
}

@Injectable()
export class TariffsService {
  private readonly logger = new Logger(TariffsService.name);

  constructor(
    @InjectRepository(TariffEntity)
    private readonly tariffRepo: Repository<TariffEntity>,
    @InjectRepository(TariffRuleEntity)
    private readonly tariffRuleRepo: Repository<TariffRuleEntity>,
  ) {}

  async create(dto: CreateTariffDto): Promise<TariffEntity> {
    const { rules, ...tariffData } = dto;

    const tariff = this.tariffRepo.create({
      ...tariffData,
      isActive: true,
    });
    const saved = await this.tariffRepo.save(tariff);

    // Save time-of-day rules
    if (rules && rules.length > 0) {
      const ruleEntities = rules.map((rule) =>
        this.tariffRuleRepo.create({ ...rule, tariffId: saved.id }),
      );
      await this.tariffRuleRepo.save(ruleEntities);
    }

    this.logger.log(`Tariff created: ${saved.id} - ${saved.name}`);
    return saved;
  }

  async findAll(): Promise<TariffEntity[]> {
    return this.tariffRepo.find({
      where: { isActive: true },
      order: { priority: 'DESC', name: 'ASC' },
    });
  }

  async findById(id: string): Promise<{ tariff: TariffEntity; rules: TariffRuleEntity[] }> {
    const tariff = await this.tariffRepo.findOne({ where: { id } });
    if (!tariff) {
      throw new NotFoundException(`Tariff ${id} not found`);
    }
    const rules = await this.tariffRuleRepo.find({ where: { tariffId: id } });
    return { tariff, rules };
  }

  async update(id: string, dto: Partial<CreateTariffDto>): Promise<TariffEntity> {
    const { tariff } = await this.findById(id);
    const { rules, ...tariffData } = dto;

    Object.assign(tariff, tariffData);
    const updated = await this.tariffRepo.save(tariff);

    if (rules) {
      // Replace rules
      await this.tariffRuleRepo.delete({ tariffId: id });
      const ruleEntities = rules.map((rule) =>
        this.tariffRuleRepo.create({ ...rule, tariffId: id }),
      );
      await this.tariffRuleRepo.save(ruleEntities);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id); // validate
    await this.tariffRepo.softDelete(id);
    this.logger.log(`Tariff ${id} deleted`);
  }

  async getApplicableTariff(chargerId: string, startTime: Date): Promise<TariffEntity | null> {
    const now = startTime || new Date();

    // Priority: charger-specific > station-specific > franchise > global
    const candidates = await this.tariffRepo
      .createQueryBuilder('tariff')
      .where('tariff.isActive = true')
      .andWhere('tariff.deletedAt IS NULL')
      .andWhere('(tariff.validFrom IS NULL OR tariff.validFrom <= :now)', { now })
      .andWhere('(tariff.validUntil IS NULL OR tariff.validUntil >= :now)', { now })
      .andWhere(
        '(tariff.chargerId = :chargerId OR tariff.chargerId IS NULL)',
        { chargerId },
      )
      .orderBy('tariff.priority', 'DESC')
      .limit(5)
      .getMany();

    if (candidates.length === 0) return null;

    // Return highest priority tariff
    return candidates[0];
  }

  async calculateCost(
    tariffId: string,
    energyKwh: number,
    durationMinutes: number,
    startTime: Date,
  ): Promise<CostBreakdown> {
    const { tariff, rules } = await this.findById(tariffId);
    const hour = (startTime || new Date()).getHours();
    const dow = (startTime || new Date()).getDay();

    // Find applicable time-of-day rule
    const applicableRule = rules.find((rule) => {
      const inTimeRange = hour >= rule.startHour && hour < rule.endHour;
      const inDayRange =
        !rule.daysOfWeek || rule.daysOfWeek.length === 0 || rule.daysOfWeek.includes(dow);
      return inTimeRange && inDayRange;
    });

    const ratePerKwh = applicableRule?.ratePerKwh ?? tariff.baseRatePerKwh;
    const ratePerMinute = applicableRule?.ratePerMinute ?? tariff.baseRatePerMinute;

    let energyCostInr = 0;
    let timeCostInr = 0;
    const sessionFeeInr = tariff.sessionFeeInr || 0;

    switch (tariff.type) {
      case TariffType.ENERGY_BASED:
        energyCostInr = energyKwh * ratePerKwh;
        break;
      case TariffType.TIME_BASED:
        timeCostInr = durationMinutes * ratePerMinute;
        break;
      case TariffType.HYBRID:
        energyCostInr = energyKwh * ratePerKwh;
        timeCostInr = durationMinutes * ratePerMinute;
        break;
      case TariffType.FLAT:
        // Only session fee
        break;
    }

    const subtotalInr = energyCostInr + timeCostInr + sessionFeeInr;
    const taxPercentage = tariff.taxPercentage || 18;
    let taxAmountInr = 0;
    let totalInr = subtotalInr;

    if (!tariff.taxInclusive) {
      taxAmountInr = (subtotalInr * taxPercentage) / 100;
      totalInr = subtotalInr + taxAmountInr;
    } else {
      // Tax is inclusive, back-calculate
      taxAmountInr = subtotalInr - subtotalInr / (1 + taxPercentage / 100);
    }

    // Apply min/max limits
    if (tariff.minimumChargeInr && totalInr < tariff.minimumChargeInr) {
      totalInr = tariff.minimumChargeInr;
    }
    if (tariff.maximumChargeInr && totalInr > tariff.maximumChargeInr) {
      totalInr = tariff.maximumChargeInr;
    }

    return {
      energyCostInr: Math.round(energyCostInr * 100) / 100,
      timeCostInr: Math.round(timeCostInr * 100) / 100,
      sessionFeeInr: Math.round(sessionFeeInr * 100) / 100,
      taxAmountInr: Math.round(taxAmountInr * 100) / 100,
      totalInr: Math.round(totalInr * 100) / 100,
      ratePerKwh,
      ratePerMinute,
      taxPercentage,
    };
  }
}
