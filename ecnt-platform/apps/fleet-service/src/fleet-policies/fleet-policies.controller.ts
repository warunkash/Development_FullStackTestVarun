import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Query,
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
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FleetPoliciesService, SetChargingPolicyDto } from './fleet-policies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

class RestrictedHoursDto {
  @ApiProperty({ example: 22, description: 'Start hour (0-23)' })
  @IsNumber()
  @Min(0)
  start: number;

  @ApiProperty({ example: 6, description: 'End hour (0-23)' })
  @IsNumber()
  @Min(0)
  end: number;
}

export class SetPolicyDto implements SetChargingPolicyDto {
  @ApiPropertyOptional({ example: 50, description: 'Max kWh per vehicle per day' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxKwhPerDay?: number;

  @ApiPropertyOptional({ example: 500, description: 'Max amount per session in INR' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmountPerSession?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['ac_type2', 'dc_ccs'],
    description: 'Allowed charger types. Empty array means all types allowed.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedChargerTypes?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Allowed station IDs. Empty array means all stations allowed.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedStationIds?: string[];

  @ApiPropertyOptional({
    type: RestrictedHoursDto,
    description: 'Hours during which charging is not allowed',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RestrictedHoursDto)
  restrictedHours?: RestrictedHoursDto;

  @ApiPropertyOptional({ example: true, description: 'Require driver authentication before charging' })
  @IsOptional()
  @IsBoolean()
  requireDriverAuth?: boolean;

  @ApiPropertyOptional({ example: 3, description: 'Max charging sessions per vehicle per day' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxSessionsPerDay?: number;
}

@ApiTags('Fleet Policies')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fleet/accounts/:fleetAccountId/policy')
export class FleetPoliciesController {
  constructor(private readonly fleetPoliciesService: FleetPoliciesService) {}

  @Post()
  @Roles('admin', 'fleet_manager')
  @ApiOperation({ summary: 'Set or update charging policy for a fleet account' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  async setPolicy(
    @Param('fleetAccountId', ParseUUIDPipe) fleetAccountId: string,
    @Body() dto: SetPolicyDto,
  ) {
    return this.fleetPoliciesService.setChargingPolicy(fleetAccountId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get current charging policy for a fleet account' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  async getPolicy(
    @Param('fleetAccountId', ParseUUIDPipe) fleetAccountId: string,
  ) {
    const policy = await this.fleetPoliciesService.getPolicy(fleetAccountId);
    return policy || { message: 'No policy set for this fleet account' };
  }

  @Get('validate')
  @ApiOperation({ summary: 'Validate if a charging session is allowed under fleet policy' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'vehicleId', required: true, type: 'string' })
  @ApiQuery({ name: 'stationId', required: true, type: 'string' })
  @ApiQuery({ name: 'chargerType', required: true, type: 'string' })
  async validateSession(
    @Param('fleetAccountId', ParseUUIDPipe) fleetAccountId: string,
    @Query('vehicleId') vehicleId: string,
    @Query('stationId') stationId: string,
    @Query('chargerType') chargerType: string,
  ) {
    return this.fleetPoliciesService.validateSessionAgainstPolicy(
      fleetAccountId,
      vehicleId,
      stationId,
      chargerType,
    );
  }
}
