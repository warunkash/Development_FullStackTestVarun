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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FleetAccountsService, PaginationQuery } from './fleet-accounts.service';
import { CreateFleetAccountDto } from './dto/create-fleet-account.dto';
import { UpdateFleetAccountDto, SuspendFleetDto } from './dto/update-fleet-account.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Fleet Accounts')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fleet/accounts')
export class FleetAccountsController {
  constructor(private readonly fleetAccountsService: FleetAccountsService) {}

  @Post()
  @Roles('admin', 'fleet_manager')
  @ApiOperation({ summary: 'Onboard a new fleet account' })
  @ApiResponse({ status: 201, description: 'Fleet account created successfully' })
  @ApiResponse({ status: 409, description: 'Fleet account with this email/GSTIN already exists' })
  async create(@Body() dto: CreateFleetAccountDto) {
    return this.fleetAccountsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all fleet accounts with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'suspended', 'inactive'] })
  @ApiQuery({ name: 'fleetType', required: false, enum: ['delivery', 'taxi', 'corporate', 'bus', 'ambulance'] })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('fleetType') fleetType?: string,
  ) {
    return this.fleetAccountsService.findAll({ page, limit, search, status, fleetType });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get fleet account by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.fleetAccountsService.findById(id);
  }

  @Put(':id')
  @Roles('admin', 'fleet_manager')
  @ApiOperation({ summary: 'Update fleet account details' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFleetAccountDto,
  ) {
    return this.fleetAccountsService.update(id, dto);
  }

  @Patch(':id/suspend')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend a fleet account' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendFleetDto,
  ) {
    return this.fleetAccountsService.suspend(id, dto.reason);
  }

  @Patch(':id/activate')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a suspended fleet account' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.fleetAccountsService.activate(id);
  }

  @Get(':id/dashboard')
  @ApiOperation({ summary: 'Get fleet account dashboard data' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getDashboard(@Param('id', ParseUUIDPipe) id: string) {
    return this.fleetAccountsService.getDashboard(id);
  }

  @Get(':id/report')
  @ApiOperation({ summary: 'Get fleet charging report for a date range' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'startDate', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2024-01-31' })
  async getReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.fleetAccountsService.getChargingReport(id, startDate, endDate);
  }
}
