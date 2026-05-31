import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  IsString,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsDateString,
  Length,
  Matches,
} from 'class-validator';
import { FleetDriversService, AddDriverDto } from './fleet-drivers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

export class AddDriverBodyDto implements AddDriverDto {
  @ApiProperty({ example: 'Ravi Kumar' })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({ example: 'TS0520230123456' })
  @IsString()
  licenseNumber: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, { message: 'Invalid phone number' })
  phone: string;

  @ApiPropertyOptional({ example: 'ravi@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @ApiPropertyOptional({ example: 'EMP001' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Fleet Drivers')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fleet/accounts/:fleetAccountId/drivers')
export class FleetDriversController {
  constructor(private readonly fleetDriversService: FleetDriversService) {}

  @Post()
  @Roles('admin', 'fleet_manager')
  @ApiOperation({ summary: 'Add a driver to a fleet account' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  async addDriver(
    @Param('fleetAccountId', ParseUUIDPipe) fleetAccountId: string,
    @Body() dto: AddDriverBodyDto,
  ) {
    return this.fleetDriversService.addDriver(fleetAccountId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all drivers in a fleet account' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  async getFleetDrivers(
    @Param('fleetAccountId', ParseUUIDPipe) fleetAccountId: string,
  ) {
    return this.fleetDriversService.getFleetDrivers(fleetAccountId);
  }

  @Put(':driverId')
  @Roles('admin', 'fleet_manager')
  @ApiOperation({ summary: 'Update driver information' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'driverId', type: 'string', format: 'uuid' })
  async updateDriver(
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Body() dto: Partial<AddDriverBodyDto>,
  ) {
    return this.fleetDriversService.updateDriver(driverId, dto);
  }

  @Patch(':driverId/deactivate')
  @Roles('admin', 'fleet_manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a fleet driver' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'driverId', type: 'string', format: 'uuid' })
  async deactivateDriver(
    @Param('driverId', ParseUUIDPipe) driverId: string,
  ) {
    return this.fleetDriversService.deactivateDriver(driverId);
  }

  @Patch(':driverId/activate')
  @Roles('admin', 'fleet_manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a fleet driver' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'driverId', type: 'string', format: 'uuid' })
  async activateDriver(@Param('driverId', ParseUUIDPipe) driverId: string) {
    return this.fleetDriversService.activateDriver(driverId);
  }

  @Get(':driverId/stats')
  @ApiOperation({ summary: 'Get charging statistics for a driver' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'driverId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'] })
  async getDriverStats(
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    return this.fleetDriversService.getDriverStats(driverId, period);
  }
}
