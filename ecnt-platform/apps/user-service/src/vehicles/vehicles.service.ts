import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { VehicleModel } from './entities/vehicle-model.entity';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  AddVehicleModelDto,
  VehicleFilterDto,
} from './dto/create-vehicle.dto';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(VehicleModel)
    private readonly vehicleModelRepository: Repository<VehicleModel>,
  ) {}

  async addVehicle(userId: string, dto: CreateVehicleDto): Promise<Vehicle> {
    // Validate vehicle model exists
    const vehicleModel = await this.vehicleModelRepository.findOne({
      where: { id: dto.vehicleModelId, isActive: true },
    });
    if (!vehicleModel) {
      throw new NotFoundException(`Vehicle model ${dto.vehicleModelId} not found`);
    }

    // Check registration number uniqueness
    const existing = await this.vehicleRepository.findOne({
      where: { registrationNumber: dto.registrationNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Vehicle with registration number ${dto.registrationNumber} already registered`,
      );
    }

    // Check user vehicle limit
    const userVehicleCount = await this.vehicleRepository.count({
      where: { userId, isActive: true },
    });
    if (userVehicleCount >= 5) {
      throw new BadRequestException('Maximum of 5 vehicles allowed per user');
    }

    const isPrimary = userVehicleCount === 0; // First vehicle is primary by default
    const vehicle = this.vehicleRepository.create({
      ...dto,
      userId,
      isPrimary,
    });

    const saved = await this.vehicleRepository.save(vehicle);
    this.logger.log(`Vehicle added for user ${userId}: ${dto.registrationNumber}`);
    return saved;
  }

  async getUserVehicles(userId: string): Promise<Vehicle[]> {
    return this.vehicleRepository.find({
      where: { userId, isActive: true },
      relations: ['vehicleModel'],
      order: { isPrimary: 'DESC', createdAt: 'DESC' },
    });
  }

  async updateVehicle(
    userId: string,
    vehicleId: string,
    dto: UpdateVehicleDto,
  ): Promise<Vehicle> {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: vehicleId, isActive: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.userId !== userId) throw new ForbiddenException('Cannot update another user vehicle');

    // Handle primary vehicle update
    if (dto.isPrimary) {
      await this.vehicleRepository.update(
        { userId, isPrimary: true },
        { isPrimary: false },
      );
    }

    Object.assign(vehicle, dto);
    return this.vehicleRepository.save(vehicle);
  }

  async removeVehicle(userId: string, vehicleId: string): Promise<{ message: string }> {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: vehicleId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.userId !== userId) throw new ForbiddenException('Cannot remove another user vehicle');
    if (vehicle.isPrimary) {
      throw new BadRequestException('Cannot remove primary vehicle. Set another vehicle as primary first.');
    }

    vehicle.isActive = false;
    await this.vehicleRepository.save(vehicle);
    this.logger.log(`Vehicle ${vehicleId} removed for user ${userId}`);
    return { message: 'Vehicle removed successfully' };
  }

  async getVehicleModels(filters: VehicleFilterDto): Promise<VehicleModel[]> {
    const query = this.vehicleModelRepository.createQueryBuilder('vm').where('vm.isActive = true');

    if (filters.brand) {
      query.andWhere('vm.brand ILIKE :brand', { brand: `%${filters.brand}%` });
    }
    if (filters.connectorType) {
      query.andWhere(':connectorType = ANY(vm.connectorTypes)', {
        connectorType: filters.connectorType,
      });
    }
    if (filters.search) {
      query.andWhere('(vm.brand ILIKE :search OR vm.model ILIKE :search OR vm.variant ILIKE :search)', {
        search: `%${filters.search}%`,
      });
    }

    return query.orderBy('vm.brand', 'ASC').addOrderBy('vm.model', 'ASC').getMany();
  }

  async addVehicleModel(dto: AddVehicleModelDto): Promise<VehicleModel> {
    const existing = await this.vehicleModelRepository.findOne({
      where: { brand: dto.brand, model: dto.model, variant: dto.variant },
    });
    if (existing) {
      throw new ConflictException('Vehicle model already exists');
    }

    const vehicleModel = this.vehicleModelRepository.create(dto);
    return this.vehicleModelRepository.save(vehicleModel);
  }

  async setRfidTag(vehicleId: string, rfidTag: string): Promise<Vehicle> {
    // Check RFID uniqueness
    const existing = await this.vehicleRepository.findOne({ where: { rfidTag } });
    if (existing && existing.id !== vehicleId) {
      throw new ConflictException('RFID tag already assigned to another vehicle');
    }

    const vehicle = await this.vehicleRepository.findOne({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    vehicle.rfidTag = rfidTag;
    return this.vehicleRepository.save(vehicle);
  }

  async findVehicleById(id: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
      relations: ['vehicleModel'],
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }
}
