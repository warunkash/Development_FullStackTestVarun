import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue')
  @ApiOperation({
    summary: 'Get revenue analytics',
    description:
      'Returns total revenue, daily/monthly breakdown, by station, and by payment method with growth comparison.',
  })
  @ApiResponse({ status: 200, description: 'Revenue metrics retrieved' })
  async getRevenueMetrics(@Query() filters: AnalyticsFilterDto) {
    return this.analyticsService.getRevenueMetrics(filters);
  }

  @Get('utilization')
  @ApiOperation({
    summary: 'Get charger utilization metrics',
    description:
      'Returns average utilization %, peak hours heatmap, and busiest periods for a station.',
  })
  @ApiQuery({ name: 'stationId', required: false })
  @ApiResponse({ status: 200, description: 'Utilization metrics retrieved' })
  async getUtilizationMetrics(
    @Query() filters: AnalyticsFilterDto,
    @Query('stationId') stationId?: string,
  ) {
    return this.analyticsService.getUtilizationMetrics(stationId, filters);
  }

  @Get('energy')
  @ApiOperation({
    summary: 'Get energy delivery metrics',
    description:
      'Returns total kWh delivered, by station, solar vs grid breakdown, and daily trends.',
  })
  @ApiResponse({ status: 200, description: 'Energy metrics retrieved' })
  async getEnergyMetrics(@Query() filters: AnalyticsFilterDto) {
    return this.analyticsService.getEnergyMetrics(filters);
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'Get charging session metrics',
    description:
      'Returns session counts, completion rates, avg duration and energy, by connector type.',
  })
  @ApiResponse({ status: 200, description: 'Session metrics retrieved' })
  async getSessionMetrics(@Query() filters: AnalyticsFilterDto) {
    return this.analyticsService.getSessionMetrics(filters);
  }

  @Get('users')
  @ApiOperation({
    summary: 'Get user analytics',
    description:
      'Returns new users, active users, retention cohort analysis, and top users by spend.',
  })
  @ApiResponse({ status: 200, description: 'User metrics retrieved' })
  async getUserMetrics(@Query() filters: AnalyticsFilterDto) {
    return this.analyticsService.getUserMetrics(filters);
  }

  @Get('carbon')
  @ApiOperation({
    summary: 'Get carbon savings metrics',
    description:
      'Calculates CO2 saved vs India grid average, trees equivalent, and fuel saved in litres.',
  })
  @ApiResponse({ status: 200, description: 'Carbon savings computed' })
  async getCarbonSavings(@Query() filters: AnalyticsFilterDto) {
    return this.analyticsService.getCarbonSavings(filters);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get admin dashboard summary',
    description:
      'Quick stats: total stations, active chargers, today revenue/kWh, active sessions, recent alerts.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard summary retrieved' })
  async getDashboardSummary() {
    return this.analyticsService.getDashboardSummary();
  }

  @Get('fleet/:fleetAccountId')
  @ApiOperation({
    summary: 'Get fleet analytics',
    description:
      'Returns per-vehicle charging summary, cost breakdown, and driver rankings for a fleet account.',
  })
  @ApiParam({ name: 'fleetAccountId', description: 'Fleet account ID' })
  @ApiResponse({ status: 200, description: 'Fleet metrics retrieved' })
  async getFleetMetrics(
    @Param('fleetAccountId') fleetAccountId: string,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getFleetMetrics(fleetAccountId, filters);
  }

  @Get('forecast/:stationId')
  @ApiOperation({
    summary: 'Get demand forecast for a station',
    description:
      'Predicts session demand for the next N hours using weighted moving average on historical data.',
  })
  @ApiParam({ name: 'stationId', description: 'Station ID' })
  @ApiQuery({ name: 'hoursAhead', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Demand forecast generated' })
  async getDemandForecast(
    @Param('stationId') stationId: string,
    @Query('hoursAhead') hoursAhead: number = 24,
  ) {
    return this.analyticsService.getDemandForecast(stationId, Number(hoursAhead));
  }
}
