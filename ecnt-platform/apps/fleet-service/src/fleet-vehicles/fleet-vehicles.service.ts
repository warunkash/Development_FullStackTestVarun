import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FleetVehicleEntity } from './fleet-vehicle.entity';
import { FleetBillingRecordEntity } from '../fleet-billing/fleet-billing-record.entity';

export interface AddVehicleDto {
  vehicleId: string;
  vehicleRegistration: string;
  vehicleModel?: string;
  vehicleName?: string;
}

@Injectable()
export class FleetVehiclesService {
  private readonly logger = new Logger(FleetVehiclesService.name);

  constructor(
    @InjectRepository(FleetVehicleEntity)
    private readonly fleetVehicleRepo: Repository<FleetVehicleEntity>,
    @InjectRepository(FleetBillingRecordEntity)
    private readonly billingRepo: Repository<FleetBillingRecordEntity>,
  ) {}

  async addVehicle(
    fleetAccountId: string,
    dto: AddVehicleDto,
  ): Promise<FleetVehicleEntity> {
    const existing = await this.fleetVehicleRepo.findOne({
      where: { fleetAccountId, vehicleId: dto.vehicleId },
    });
    if (existing) {
      throw new ConflictException(
        `Vehicle ${dto.vehicleId} is already in fleet account ${fleetAccountId}`,
      );
    }

    const vehicle = this.fleetVehicleRepo.create({
      fleetAccountId,
      vehicleId: dto.vehicleId,
      vehicleRegistration: dto.vehicleRegistration,
      vehicleModel: dto.vehicleModel,
      vehicleName: dto.vehicleName,
      status: 'active',
      chargingStatus: 'idle',
    });

    const saved = await this.fleetVehicleRepo.save(vehicle);
    this.logger.log(
      `Vehicle ${dto.vehicleId} added to fleet ${fleetAccountId}`,
    );
    return saved;
  }

  async removeVehicle(
    fleetAccountId: string,
    vehicleId: string,
  ): Promise<void> {
    const vehicle = await this.fleetVehicleRepo.findOne({
      where: { fleetAccountId, vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException(
        `Vehicle ${vehicleId} not found in fleet ${fleetAccountId}`,
      );
    }
    vehicle.status = 'removed';
    await this.fleetVehicleRepo.save(vehicle);
    this.logger.log(`Vehicle ${vehicleId} removed from fleet ${fleetAccountId}`);
  }

  async getFleetVehicles(
    fleetAccountId: string,
  ): Promise<{ vehicles: FleetVehicleEntity[]; summary: any }> {
    const vehicles = await this.fleetVehicleRepo.find({
      where: { fleetAccountId },
      order: { addedAt: 'DESC' },
    });

    const summary = {
      total: vehicles.length,
      active: vehicles.filter((v) => v.status === 'active').length,
      charging: vehicles.filter((v) => v.chargingStatus === 'charging').length,
      idle: vehicles.filter((v) => v.chargingStatus === 'idle').length,
      totalKwh: vehicles.reduce((sum, v) => sum + Number(v.totalKwhConsumed), 0),
      totalSpend: vehicles.reduce((sum, v) => sum + Number(v.totalSpend), 0),
    };

    return { vehicles, summary };
  }

  async assignDriver(
    vehicleId: string,
    driverId: string,
  ): Promise<FleetVehicleEntity> {
    const vehicle = await this.fleetVehicleRepo.findOne({
      where: { vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found in any fleet`);
    }
    vehicle.assignedDriverId = driverId;
    return this.fleetVehicleRepo.save(vehicle);
  }

  async unassignDriver(vehicleId: string): Promise<FleetVehicleEntity> {
    const vehicle = await this.fleetVehicleRepo.findOne({
      where: { vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found in any fleet`);
    }
    vehicle.assignedDriverId = null;
    return this.fleetVehicleRepo.save(vehicle);
  }

  async getVehicleChargingHistory(
    vehicleId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month',
  ): Promise<{ sessions: any[]; summary: any }> {
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
      .where('br.fleet_vehicle_id = :vehicleId', { vehicleId })
      .andWhere('br.created_at >= :startDate', { startDate })
      .orderBy('br.created_at', 'DESC')
      .getMany();

    const totalAmount = sessions.reduce((sum, s) => sum + Number(s.amount), 0);
    const totalKwh = sessions.reduce(
      (sum, s) => sum + Number(s.energyKwh),
      0,
    );

    return {
      sessions,
      summary: {
        totalSessions: sessions.length,
        totalKwh: Math.round(totalKwh * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        period,
        startDate,
        endDate: now,
      },
    };
  }
}
