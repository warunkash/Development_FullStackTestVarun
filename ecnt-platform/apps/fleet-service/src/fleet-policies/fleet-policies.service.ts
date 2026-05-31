import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FleetPolicyEntity, RestrictedHours } from './fleet-policy.entity';
import { FleetVehicleEntity } from '../fleet-vehicles/fleet-vehicle.entity';
import { FleetBillingRecordEntity } from '../fleet-billing/fleet-billing-record.entity';

export interface SetChargingPolicyDto {
  maxKwhPerDay?: number;
  maxAmountPerSession?: number;
  allowedChargerTypes?: string[];
  allowedStationIds?: string[];
  restrictedHours?: RestrictedHours;
  requireDriverAuth?: boolean;
  maxSessionsPerDay?: number;
}

export interface PolicyValidationResult {
  allowed: boolean;
  reason?: string;
  policy?: FleetPolicyEntity;
}

@Injectable()
export class FleetPoliciesService {
  private readonly logger = new Logger(FleetPoliciesService.name);

  constructor(
    @InjectRepository(FleetPolicyEntity)
    private readonly policyRepo: Repository<FleetPolicyEntity>,
    @InjectRepository(FleetVehicleEntity)
    private readonly vehicleRepo: Repository<FleetVehicleEntity>,
    @InjectRepository(FleetBillingRecordEntity)
    private readonly billingRepo: Repository<FleetBillingRecordEntity>,
  ) {}

  async setChargingPolicy(
    fleetAccountId: string,
    dto: SetChargingPolicyDto,
  ): Promise<FleetPolicyEntity> {
    let policy = await this.policyRepo.findOne({
      where: { fleetAccountId },
    });

    if (policy) {
      Object.assign(policy, dto);
      this.logger.log(`Policy updated for fleet account ${fleetAccountId}`);
    } else {
      policy = this.policyRepo.create({
        fleetAccountId,
        allowedChargerTypes: dto.allowedChargerTypes || [],
        allowedStationIds: dto.allowedStationIds || [],
        requireDriverAuth: dto.requireDriverAuth ?? false,
        isActive: true,
        ...dto,
      });
      this.logger.log(`Policy created for fleet account ${fleetAccountId}`);
    }

    return this.policyRepo.save(policy);
  }

  async getPolicy(fleetAccountId: string): Promise<FleetPolicyEntity | null> {
    const policy = await this.policyRepo.findOne({
      where: { fleetAccountId },
    });
    return policy;
  }

  async validateSessionAgainstPolicy(
    fleetAccountId: string,
    vehicleId: string,
    stationId: string,
    chargerType: string,
  ): Promise<PolicyValidationResult> {
    const policy = await this.policyRepo.findOne({
      where: { fleetAccountId, isActive: true },
    });

    if (!policy) {
      return { allowed: true, reason: 'No policy set for this fleet' };
    }

    // Check allowed charger types
    if (
      policy.allowedChargerTypes.length > 0 &&
      !policy.allowedChargerTypes.includes(chargerType)
    ) {
      return {
        allowed: false,
        reason: `Charger type '${chargerType}' is not allowed. Allowed types: ${policy.allowedChargerTypes.join(', ')}`,
        policy,
      };
    }

    // Check allowed stations
    if (
      policy.allowedStationIds.length > 0 &&
      !policy.allowedStationIds.includes(stationId)
    ) {
      return {
        allowed: false,
        reason: `Station ${stationId} is not in the allowed stations list for this fleet`,
        policy,
      };
    }

    // Check restricted hours
    if (policy.restrictedHours) {
      const now = new Date();
      const currentHour = now.getHours();
      const { start, end } = policy.restrictedHours;

      let isRestricted: boolean;
      if (start <= end) {
        isRestricted = currentHour >= start && currentHour < end;
      } else {
        // Crosses midnight (e.g., 22:00 to 06:00)
        isRestricted = currentHour >= start || currentHour < end;
      }

      if (isRestricted) {
        return {
          allowed: false,
          reason: `Charging is restricted between ${start}:00 and ${end}:00 hours`,
          policy,
        };
      }
    }

    // Check daily kWh limit for the vehicle
    if (policy.maxKwhPerDay) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayKwh = await this.billingRepo
        .createQueryBuilder('br')
        .select('SUM(br.energy_kwh)', 'totalKwh')
        .where('br.fleet_account_id = :fleetAccountId', { fleetAccountId })
        .andWhere('br.fleet_vehicle_id = :vehicleId', { vehicleId })
        .andWhere('br.created_at >= :today', { today })
        .getRawOne();

      const kwhUsedToday = parseFloat(todayKwh?.totalKwh || '0');

      if (kwhUsedToday >= Number(policy.maxKwhPerDay)) {
        return {
          allowed: false,
          reason: `Daily kWh limit of ${policy.maxKwhPerDay} kWh reached for this vehicle. Used today: ${kwhUsedToday.toFixed(2)} kWh`,
          policy,
        };
      }
    }

    // Check daily session count
    if (policy.maxSessionsPerDay) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sessionsTodayCount = await this.billingRepo.count({
        where: {
          fleetAccountId,
          fleetVehicleId: vehicleId,
        },
      });

      if (sessionsTodayCount >= policy.maxSessionsPerDay) {
        return {
          allowed: false,
          reason: `Daily session limit of ${policy.maxSessionsPerDay} reached for this vehicle`,
          policy,
        };
      }
    }

    return { allowed: true, policy };
  }

  async deactivatePolicy(fleetAccountId: string): Promise<void> {
    const policy = await this.policyRepo.findOne({
      where: { fleetAccountId },
    });
    if (policy) {
      policy.isActive = false;
      await this.policyRepo.save(policy);
    }
  }
}
