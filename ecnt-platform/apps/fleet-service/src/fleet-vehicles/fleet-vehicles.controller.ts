import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FleetVehiclesService } from './fleet-vehicles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

export class AddVehicleBodyDto {
  @ApiProperty({ example: 'uuid-vehicle-id' })
  @IsString()
  vehicleId: string;

  @ApiProperty({ example: 'TS09EF1234' })
  @IsString()
  vehicleRegistration: string;

  @ApiPropertyOptional({ example: 'Tata Nexon EV' })
  @IsOptional()
  @IsString()
  vehicleModel?: string;

  @ApiPropertyOptional({ example: 'Nexon-01' })
  @IsOptional()
  @IsString()
  vehicleName?: string;
}

export class AssignDriverBodyDto {
  @ApiProperty({ example: 'uuid-driver-id' })
  @IsString()
  driverId: string;
}

@ApiTags('Fleet Vehicles')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fleet/accounts/:fleetAccountId/vehicles')
export class FleetVehiclesController {
  constructor(private readonly fleetVehiclesService: FleetVehiclesService) {}

  @Post()
  @Roles('admin', 'fleet_manager')
  @ApiOperation({ summary: 'Add a vehicle to a fleet account' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  async addVehicle(
    @Param('fleetAccountId', ParseUUIDPipe) fleetAccountId: string,
    @Body() dto: AddVehicleBodyDto,
  ) {
    return this.fleetVehiclesService.addVehicle(fleetAccountId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all vehicles in a fleet account' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  async getFleetVehicles(
    @Param('fleetAccountId', ParseUUIDPipe) fleetAccountId: string,
  ) {
    return this.fleetVehiclesService.getFleetVehicles(fleetAccountId);
  }

  @Delete(':vehicleId')
  @Roles('admin', 'fleet_manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a vehicle from a fleet account' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'vehicleId', type: 'string' })
  async removeVehicle(
    @Param('fleetAccountId', ParseUUIDPipe) fleetAccountId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    await this.fleetVehiclesService.removeVehicle(fleetAccountId, vehicleId);
    return { message: 'Vehicle removed from fleet successfully' };
  }

  @Patch(':vehicleId/assign-driver')
  @Roles('admin', 'fleet_manager')
  @ApiOperation({ summary: 'Assign a driver to a fleet vehicle' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'vehicleId', type: 'string' })
  async assignDriver(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: AssignDriverBodyDto,
  ) {
    return this.fleetVehiclesService.assignDriver(vehicleId, dto.driverId);
  }

  @Patch(':vehicleId/unassign-driver')
  @Roles('admin', 'fleet_manager')
  @ApiOperation({ summary: 'Unassign driver from a fleet vehicle' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'vehicleId', type: 'string' })
  async unassignDriver(@Param('vehicleId') vehicleId: string) {
    return this.fleetVehiclesService.unassignDriver(vehicleId);
  }

  @Get(':vehicleId/history')
  @ApiOperation({ summary: 'Get charging history for a fleet vehicle' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'vehicleId', type: 'string' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'], description: 'Time period for history' })
  async getVehicleHistory(
    @Param('vehicleId') vehicleId: string,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    return this.fleetVehiclesService.getVehicleChargingHistory(vehicleId, period);
  }
}
