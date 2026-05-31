import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment';
import { AnalyticsFilterDto, AnalyticsPeriod } from './dto/analytics-filter.dto';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface RevenueMetrics {
  total: number;
  currency: string;
  daily: { date: string; amount: number; sessionCount: number }[];
  monthly: { month: string; amount: number; sessionCount: number }[];
  byStation: { stationId: string; stationName: string; amount: number }[];
  byPaymentMethod: { method: string; amount: number; count: number }[];
  growth: { currentPeriod: number; previousPeriod: number; growthPercent: number };
}

export interface UtilizationMetrics {
  avgUtilizationPercent: number;
  peakHours: { hour: number; utilizationPercent: number; avgSessions: number }[];
  heatmap: { dayOfWeek: number; hour: number; utilizationPercent: number }[];
  busiest: { day: string; hour: number };
  idlestHours: { hour: number }[];
}

export interface EnergyMetrics {
  totalKwh: number;
  avgKwhPerSession: number;
  byStation: { stationId: string; stationName: string; totalKwh: number }[];
  solarVsGrid: { solarKwh: number; gridKwh: number; solarPercent: number };
  daily: { date: string; kwh: number }[];
  peakDemandKw: number;
}

export interface SessionMetrics {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  completionRate: number;
  avgDurationMin: number;
  avgEnergyKwh: number;
  avgCostInr: number;
  byConnectorType: { type: string; count: number }[];
  daily: { date: string; count: number; completed: number }[];
}

export interface UserMetrics {
  newUsers: number;
  activeUsers: number;
  totalUsers: number;
  retentionRate: number;
  avgSessionsPerUser: number;
  retention: { cohort: string; week1: number; week4: number; week12: number }[];
  topUsers: { userId: string; sessions: number; totalKwh: number; totalSpend: number }[];
}

export interface CarbonSavings {
  co2SavedKg: number;
  treesEquivalent: number;
  fuelSavedLitres: number;
  distanceEquivalentKm: number;
  co2SavingsTarget: number;
  achievementPercent: number;
}

export interface DashboardSummary {
  totalStations: number;
  activeChargers: number;
  activeSessions: number;
  todayRevenue: number;
  todayKwh: number;
  todaySessions: number;
  monthRevenue: number;
  monthKwh: number;
  totalUsers: number;
  avgStationUtilization: number;
  recentAlerts: { type: string; message: string; stationId: string; timestamp: Date }[];
}

export interface DemandForecast {
  stationId: string;
  forecasts: {
    timestamp: Date;
    predictedSessions: number;
    confidence: number;
    historicalAvg: number;
  }[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  // India average grid emission factor: 0.82 kg CO2/kWh (CEA 2022-23)
  private readonly GRID_EMISSION_FACTOR = 0.82;
  // Average petrol car: 8L/100km, CO2 from petrol: 2.31 kg/L
  private readonly PETROL_CO2_PER_LITRE = 2.31;
  // Average EV efficiency: 6 km/kWh
  private readonly EV_EFFICIENCY_KM_PER_KWH = 6;
  // Petrol car fuel consumption: 0.12 L/km
  private readonly PETROL_CONSUMPTION_L_PER_KM = 0.12;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  resolveDateRange(filters: AnalyticsFilterDto): DateRange {
    const now = moment();
    let start: moment.Moment;
    let end: moment.Moment = now.clone().endOf('day');

    switch (filters.period) {
      case AnalyticsPeriod.TODAY:
        start = now.clone().startOf('day');
        break;
      case AnalyticsPeriod.YESTERDAY:
        start = now.clone().subtract(1, 'day').startOf('day');
        end = now.clone().subtract(1, 'day').endOf('day');
        break;
      case AnalyticsPeriod.LAST_7_DAYS:
        start = now.clone().subtract(7, 'days').startOf('day');
        break;
      case AnalyticsPeriod.LAST_30_DAYS:
        start = now.clone().subtract(30, 'days').startOf('day');
        break;
      case AnalyticsPeriod.LAST_3_MONTHS:
        start = now.clone().subtract(3, 'months').startOf('day');
        break;
      case AnalyticsPeriod.LAST_YEAR:
        start = now.clone().subtract(1, 'year').startOf('day');
        break;
      case AnalyticsPeriod.CUSTOM:
        start = moment(filters.startDate).startOf('day');
        end = moment(filters.endDate).endOf('day');
        break;
      default:
        start = now.clone().subtract(30, 'days').startOf('day');
    }

    return { start: start.toDate(), end: end.toDate() };
  }

  async getRevenueMetrics(filters: AnalyticsFilterDto): Promise<RevenueMetrics> {
    this.logger.debug(`Fetching revenue metrics for period: ${filters.period}`);
    const { start, end } = this.resolveDateRange(filters);

    // Previous period for growth calculation
    const periodDays = moment(end).diff(moment(start), 'days');
    const prevStart = moment(start).subtract(periodDays, 'days').toDate();
    const prevEnd = moment(start).subtract(1, 'second').toDate();

    // Build base WHERE clause
    const stationFilter = filters.stationId ? `AND cs.station_id = '${filters.stationId}'` : '';
    const franchiseeFilter = filters.franchiseeId ? `AND cs.franchisee_id = '${filters.franchiseeId}'` : '';

    // Total revenue
    const totalResult = await this.dataSource.query(
      `SELECT COALESCE(SUM(p.amount), 0) as total, COUNT(*) as count
       FROM payments p
       LEFT JOIN charging_sessions cs ON p.session_id = cs.id
       WHERE p.status = 'completed'
         AND p.created_at BETWEEN $1 AND $2
         ${stationFilter} ${franchiseeFilter}`,
      [start, end],
    );

    // Previous period revenue (for growth)
    const prevResult = await this.dataSource.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments
       WHERE status = 'completed' AND created_at BETWEEN $1 AND $2`,
      [prevStart, prevEnd],
    );

    // Daily breakdown
    const dailyResult = await this.dataSource.query(
      `SELECT DATE(p.created_at) as date,
              COALESCE(SUM(p.amount), 0) as amount,
              COUNT(*) as session_count
       FROM payments p
       WHERE p.status = 'completed' AND p.created_at BETWEEN $1 AND $2
       GROUP BY DATE(p.created_at)
       ORDER BY date ASC`,
      [start, end],
    );

    // Monthly breakdown
    const monthlyResult = await this.dataSource.query(
      `SELECT TO_CHAR(p.created_at, 'YYYY-MM') as month,
              COALESCE(SUM(p.amount), 0) as amount,
              COUNT(*) as session_count
       FROM payments p
       WHERE p.status = 'completed' AND p.created_at BETWEEN $1 AND $2
       GROUP BY TO_CHAR(p.created_at, 'YYYY-MM')
       ORDER BY month ASC`,
      [start, end],
    );

    // Revenue by station
    const stationResult = await this.dataSource.query(
      `SELECT cs.station_id,
              COALESCE(s.name, cs.station_id) as station_name,
              COALESCE(SUM(p.amount), 0) as amount
       FROM payments p
       JOIN charging_sessions cs ON p.session_id = cs.id
       LEFT JOIN stations s ON cs.station_id = s.id
       WHERE p.status = 'completed' AND p.created_at BETWEEN $1 AND $2
       GROUP BY cs.station_id, s.name
       ORDER BY amount DESC
       LIMIT 10`,
      [start, end],
    );

    // Revenue by payment method
    const methodResult = await this.dataSource.query(
      `SELECT payment_method as method,
              COALESCE(SUM(amount), 0) as amount,
              COUNT(*) as count
       FROM payments
       WHERE status = 'completed' AND created_at BETWEEN $1 AND $2
       GROUP BY payment_method
       ORDER BY amount DESC`,
      [start, end],
    );

    const currentTotal = Number(totalResult[0]?.total || 0);
    const previousTotal = Number(prevResult[0]?.total || 0);
    const growthPercent =
      previousTotal > 0
        ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100 * 10) / 10
        : 100;

    return {
      total: currentTotal,
      currency: 'INR',
      daily: dailyResult.map((r) => ({
        date: r.date,
        amount: Number(r.amount),
        sessionCount: Number(r.session_count),
      })),
      monthly: monthlyResult.map((r) => ({
        month: r.month,
        amount: Number(r.amount),
        sessionCount: Number(r.session_count),
      })),
      byStation: stationResult.map((r) => ({
        stationId: r.station_id,
        stationName: r.station_name,
        amount: Number(r.amount),
      })),
      byPaymentMethod: methodResult.map((r) => ({
        method: r.method,
        amount: Number(r.amount),
        count: Number(r.count),
      })),
      growth: {
        currentPeriod: currentTotal,
        previousPeriod: previousTotal,
        growthPercent,
      },
    };
  }

  async getUtilizationMetrics(
    stationId: string,
    filters: AnalyticsFilterDto,
  ): Promise<UtilizationMetrics> {
    this.logger.debug(`Fetching utilization metrics for station: ${stationId}`);
    const { start, end } = this.resolveDateRange(filters);

    const stationFilter = stationId ? `AND cs.station_id = $3` : '';
    const params: any[] = [start, end];
    if (stationId) params.push(stationId);

    // Average utilization: sessions per charger per operating hour
    const utilizationResult = await this.dataSource.query(
      `SELECT
         COUNT(DISTINCT cs.charger_id) as total_chargers,
         SUM(EXTRACT(EPOCH FROM (cs.ended_at - cs.started_at)) / 3600) as total_session_hours,
         COUNT(*) as total_sessions
       FROM charging_sessions cs
       WHERE cs.status = 'completed'
         AND cs.started_at BETWEEN $1 AND $2
         ${stationFilter}`,
      params,
    );

    const totalHoursInPeriod = moment(end).diff(moment(start), 'hours');
    const totalChargers = Number(utilizationResult[0]?.total_chargers || 1);
    const totalSessionHours = Number(utilizationResult[0]?.total_session_hours || 0);
    const maxCapacityHours = totalChargers * totalHoursInPeriod;
    const avgUtilizationPercent =
      maxCapacityHours > 0
        ? Math.round((totalSessionHours / maxCapacityHours) * 100 * 10) / 10
        : 0;

    // Peak hours - sessions by hour of day
    const peakHoursResult = await this.dataSource.query(
      `SELECT
         EXTRACT(HOUR FROM cs.started_at) as hour,
         COUNT(*) as session_count,
         AVG(COUNT(*)) OVER () as avg_sessions
       FROM charging_sessions cs
       WHERE cs.started_at BETWEEN $1 AND $2 ${stationFilter}
       GROUP BY EXTRACT(HOUR FROM cs.started_at)
       ORDER BY session_count DESC`,
      params,
    );

    const maxSessions = Math.max(...peakHoursResult.map((r) => Number(r.session_count)), 1);

    // Heatmap: day of week x hour
    const heatmapResult = await this.dataSource.query(
      `SELECT
         EXTRACT(DOW FROM cs.started_at) as day_of_week,
         EXTRACT(HOUR FROM cs.started_at) as hour,
         COUNT(*) as session_count
       FROM charging_sessions cs
       WHERE cs.started_at BETWEEN $1 AND $2 ${stationFilter}
       GROUP BY day_of_week, hour
       ORDER BY day_of_week, hour`,
      params,
    );

    const heatmapMax = Math.max(...heatmapResult.map((r) => Number(r.session_count)), 1);

    // Busiest period
    const busiestResult = await this.dataSource.query(
      `SELECT
         TO_CHAR(cs.started_at, 'Day') as day,
         EXTRACT(HOUR FROM cs.started_at) as hour,
         COUNT(*) as count
       FROM charging_sessions cs
       WHERE cs.started_at BETWEEN $1 AND $2 ${stationFilter}
       GROUP BY TO_CHAR(cs.started_at, 'Day'), EXTRACT(HOUR FROM cs.started_at)
       ORDER BY count DESC
       LIMIT 1`,
      params,
    );

    return {
      avgUtilizationPercent,
      peakHours: peakHoursResult.map((r) => ({
        hour: Number(r.hour),
        utilizationPercent: Math.round((Number(r.session_count) / maxSessions) * 100),
        avgSessions: Math.round(Number(r.avg_sessions) * 10) / 10,
      })),
      heatmap: heatmapResult.map((r) => ({
        dayOfWeek: Number(r.day_of_week),
        hour: Number(r.hour),
        utilizationPercent: Math.round((Number(r.session_count) / heatmapMax) * 100),
      })),
      busiest: {
        day: busiestResult[0]?.day?.trim() || 'N/A',
        hour: Number(busiestResult[0]?.hour || 0),
      },
      idlestHours: peakHoursResult
        .slice(-3)
        .map((r) => ({ hour: Number(r.hour) })),
    };
  }

  async getEnergyMetrics(filters: AnalyticsFilterDto): Promise<EnergyMetrics> {
    this.logger.debug(`Fetching energy metrics`);
    const { start, end } = this.resolveDateRange(filters);
    const stationFilter = filters.stationId ? `AND cs.station_id = $3` : '';
    const params: any[] = [start, end];
    if (filters.stationId) params.push(filters.stationId);

    // Total energy delivered
    const totalResult = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(cs.energy_delivered_kwh), 0) as total_kwh,
         AVG(cs.energy_delivered_kwh) as avg_kwh,
         MAX(cs.peak_power_kw) as peak_demand_kw
       FROM charging_sessions cs
       WHERE cs.status = 'completed' AND cs.started_at BETWEEN $1 AND $2 ${stationFilter}`,
      params,
    );

    // Energy by station
    const stationResult = await this.dataSource.query(
      `SELECT cs.station_id,
              COALESCE(s.name, cs.station_id) as station_name,
              COALESCE(SUM(cs.energy_delivered_kwh), 0) as total_kwh
       FROM charging_sessions cs
       LEFT JOIN stations s ON cs.station_id = s.id
       WHERE cs.status = 'completed' AND cs.started_at BETWEEN $1 AND $2 ${stationFilter}
       GROUP BY cs.station_id, s.name
       ORDER BY total_kwh DESC
       LIMIT 10`,
      params,
    );

    // Solar vs grid breakdown (from station telemetry)
    const solarResult = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(sm.solar_generation_kwh), 0) as solar_kwh,
         COALESCE(SUM(sm.grid_consumption_kwh), 0) as grid_kwh
       FROM station_metrics sm
       JOIN stations s ON sm.station_id = s.id
       WHERE sm.recorded_at BETWEEN $1 AND $2
       ${filters.stationId ? `AND sm.station_id = $3` : ''}`,
      params,
    );

    // Daily energy
    const dailyResult = await this.dataSource.query(
      `SELECT DATE(cs.started_at) as date,
              COALESCE(SUM(cs.energy_delivered_kwh), 0) as kwh
       FROM charging_sessions cs
       WHERE cs.status = 'completed' AND cs.started_at BETWEEN $1 AND $2 ${stationFilter}
       GROUP BY DATE(cs.started_at)
       ORDER BY date ASC`,
      params,
    );

    const totalKwh = Number(totalResult[0]?.total_kwh || 0);
    const solarKwh = Number(solarResult[0]?.solar_kwh || 0);
    const gridKwh = Number(solarResult[0]?.grid_kwh || totalKwh);
    const totalEnergy = solarKwh + gridKwh || totalKwh;
    const solarPercent =
      totalEnergy > 0 ? Math.round((solarKwh / totalEnergy) * 100 * 10) / 10 : 0;

    return {
      totalKwh: Math.round(totalKwh * 100) / 100,
      avgKwhPerSession: Math.round(Number(totalResult[0]?.avg_kwh || 0) * 100) / 100,
      byStation: stationResult.map((r) => ({
        stationId: r.station_id,
        stationName: r.station_name,
        totalKwh: Math.round(Number(r.total_kwh) * 100) / 100,
      })),
      solarVsGrid: {
        solarKwh: Math.round(solarKwh * 100) / 100,
        gridKwh: Math.round(gridKwh * 100) / 100,
        solarPercent,
      },
      daily: dailyResult.map((r) => ({
        date: r.date,
        kwh: Math.round(Number(r.kwh) * 100) / 100,
      })),
      peakDemandKw: Math.round(Number(totalResult[0]?.peak_demand_kw || 0) * 100) / 100,
    };
  }

  async getSessionMetrics(filters: AnalyticsFilterDto): Promise<SessionMetrics> {
    this.logger.debug('Fetching session metrics');
    const { start, end } = this.resolveDateRange(filters);
    const stationFilter = filters.stationId ? `AND cs.station_id = $3` : '';
    const params: any[] = [start, end];
    if (filters.stationId) params.push(filters.stationId);

    const summaryResult = await this.dataSource.query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
         AVG(CASE WHEN status = 'completed'
             THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 60 END) as avg_duration_min,
         AVG(CASE WHEN status = 'completed' THEN energy_delivered_kwh END) as avg_energy_kwh,
         AVG(CASE WHEN status = 'completed' THEN total_cost END) as avg_cost_inr
       FROM charging_sessions cs
       WHERE cs.started_at BETWEEN $1 AND $2 ${stationFilter}`,
      params,
    );

    const connectorResult = await this.dataSource.query(
      `SELECT c.connector_type as type, COUNT(*) as count
       FROM charging_sessions cs
       JOIN chargers c ON cs.charger_id = c.id
       WHERE cs.started_at BETWEEN $1 AND $2 ${stationFilter}
       GROUP BY c.connector_type
       ORDER BY count DESC`,
      params,
    );

    const dailyResult = await this.dataSource.query(
      `SELECT DATE(started_at) as date,
              COUNT(*) as count,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM charging_sessions cs
       WHERE started_at BETWEEN $1 AND $2 ${stationFilter}
       GROUP BY DATE(started_at)
       ORDER BY date ASC`,
      params,
    );

    const s = summaryResult[0];
    const total = Number(s?.total || 0);
    const completed = Number(s?.completed || 0);

    return {
      total,
      completed,
      failed: Number(s?.failed || 0),
      cancelled: Number(s?.cancelled || 0),
      completionRate: total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0,
      avgDurationMin: Math.round(Number(s?.avg_duration_min || 0) * 10) / 10,
      avgEnergyKwh: Math.round(Number(s?.avg_energy_kwh || 0) * 100) / 100,
      avgCostInr: Math.round(Number(s?.avg_cost_inr || 0) * 100) / 100,
      byConnectorType: connectorResult.map((r) => ({
        type: r.type,
        count: Number(r.count),
      })),
      daily: dailyResult.map((r) => ({
        date: r.date,
        count: Number(r.count),
        completed: Number(r.completed),
      })),
    };
  }

  async getUserMetrics(filters: AnalyticsFilterDto): Promise<UserMetrics> {
    this.logger.debug('Fetching user metrics');
    const { start, end } = this.resolveDateRange(filters);

    // New users in period
    const newUsersResult = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM users WHERE created_at BETWEEN $1 AND $2`,
      [start, end],
    );

    // Active users (users with at least 1 session)
    const activeUsersResult = await this.dataSource.query(
      `SELECT COUNT(DISTINCT user_id) as count FROM charging_sessions
       WHERE started_at BETWEEN $1 AND $2`,
      [start, end],
    );

    // Total users
    const totalUsersResult = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM users WHERE created_at <= $1`,
      [end],
    );

    // Avg sessions per active user
    const avgSessionsResult = await this.dataSource.query(
      `SELECT AVG(session_count) as avg_sessions FROM (
         SELECT user_id, COUNT(*) as session_count
         FROM charging_sessions
         WHERE started_at BETWEEN $1 AND $2
         GROUP BY user_id
       ) sub`,
      [start, end],
    );

    // Retention cohort (monthly)
    const retentionResult = await this.dataSource.query(
      `SELECT
         TO_CHAR(u.created_at, 'YYYY-MM') as cohort,
         COUNT(DISTINCT u.id) as cohort_size,
         COUNT(DISTINCT CASE
           WHEN cs.started_at BETWEEN u.created_at AND u.created_at + INTERVAL '7 days'
           THEN u.id END) as week1_retained,
         COUNT(DISTINCT CASE
           WHEN cs.started_at BETWEEN u.created_at AND u.created_at + INTERVAL '28 days'
           THEN u.id END) as week4_retained,
         COUNT(DISTINCT CASE
           WHEN cs.started_at BETWEEN u.created_at AND u.created_at + INTERVAL '84 days'
           THEN u.id END) as week12_retained
       FROM users u
       LEFT JOIN charging_sessions cs ON cs.user_id = u.id
       WHERE u.created_at BETWEEN $1 AND $2
       GROUP BY TO_CHAR(u.created_at, 'YYYY-MM')
       ORDER BY cohort DESC
       LIMIT 6`,
      [start, end],
    );

    // Top users by spend
    const topUsersResult = await this.dataSource.query(
      `SELECT
         cs.user_id,
         COUNT(*) as sessions,
         COALESCE(SUM(cs.energy_delivered_kwh), 0) as total_kwh,
         COALESCE(SUM(cs.total_cost), 0) as total_spend
       FROM charging_sessions cs
       WHERE cs.started_at BETWEEN $1 AND $2
       GROUP BY cs.user_id
       ORDER BY total_spend DESC
       LIMIT 10`,
      [start, end],
    );

    const totalUsers = Number(totalUsersResult[0]?.count || 0);
    const activeUsers = Number(activeUsersResult[0]?.count || 0);
    const retentionRate =
      totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100 * 10) / 10 : 0;

    return {
      newUsers: Number(newUsersResult[0]?.count || 0),
      activeUsers,
      totalUsers,
      retentionRate,
      avgSessionsPerUser: Math.round(Number(avgSessionsResult[0]?.avg_sessions || 0) * 10) / 10,
      retention: retentionResult.map((r) => ({
        cohort: r.cohort,
        week1: r.cohort_size > 0 ? Math.round((r.week1_retained / r.cohort_size) * 100) : 0,
        week4: r.cohort_size > 0 ? Math.round((r.week4_retained / r.cohort_size) * 100) : 0,
        week12: r.cohort_size > 0 ? Math.round((r.week12_retained / r.cohort_size) * 100) : 0,
      })),
      topUsers: topUsersResult.map((r) => ({
        userId: r.user_id,
        sessions: Number(r.sessions),
        totalKwh: Math.round(Number(r.total_kwh) * 100) / 100,
        totalSpend: Math.round(Number(r.total_spend) * 100) / 100,
      })),
    };
  }

  async getFleetMetrics(
    fleetAccountId: string,
    filters: AnalyticsFilterDto,
  ): Promise<any> {
    this.logger.debug(`Fetching fleet metrics for: ${fleetAccountId}`);
    const { start, end } = this.resolveDateRange(filters);

    const fleetSummary = await this.dataSource.query(
      `SELECT
         fv.vehicle_id,
         fv.license_plate,
         fv.driver_name,
         COUNT(cs.id) as session_count,
         COALESCE(SUM(cs.energy_delivered_kwh), 0) as total_kwh,
         COALESCE(SUM(cs.total_cost), 0) as total_cost,
         AVG(cs.energy_delivered_kwh) as avg_kwh_per_session,
         COALESCE(SUM(EXTRACT(EPOCH FROM (cs.ended_at - cs.started_at)) / 60), 0) as total_charging_min
       FROM fleet_vehicles fv
       LEFT JOIN charging_sessions cs ON cs.vehicle_id = fv.vehicle_id
         AND cs.started_at BETWEEN $1 AND $2
       WHERE fv.fleet_account_id = $3 AND fv.is_active = true
       GROUP BY fv.vehicle_id, fv.license_plate, fv.driver_name
       ORDER BY total_cost DESC`,
      [start, end, fleetAccountId],
    );

    const fleetTotal = await this.dataSource.query(
      `SELECT
         COUNT(cs.id) as total_sessions,
         COALESCE(SUM(cs.energy_delivered_kwh), 0) as total_kwh,
         COALESCE(SUM(cs.total_cost), 0) as total_cost,
         AVG(cs.total_cost) as avg_cost_per_session
       FROM charging_sessions cs
       JOIN fleet_vehicles fv ON cs.vehicle_id = fv.vehicle_id
       WHERE fv.fleet_account_id = $3
         AND cs.started_at BETWEEN $1 AND $2`,
      [start, end, fleetAccountId],
    );

    const t = fleetTotal[0];
    return {
      fleetAccountId,
      period: { start, end },
      summary: {
        totalSessions: Number(t?.total_sessions || 0),
        totalKwh: Math.round(Number(t?.total_kwh || 0) * 100) / 100,
        totalCost: Math.round(Number(t?.total_cost || 0) * 100) / 100,
        avgCostPerSession: Math.round(Number(t?.avg_cost_per_session || 0) * 100) / 100,
        activeVehicles: fleetSummary.filter((v) => Number(v.session_count) > 0).length,
        totalVehicles: fleetSummary.length,
      },
      vehicles: fleetSummary.map((v) => ({
        vehicleId: v.vehicle_id,
        licensePlate: v.license_plate,
        driverName: v.driver_name,
        sessions: Number(v.session_count),
        totalKwh: Math.round(Number(v.total_kwh) * 100) / 100,
        totalCost: Math.round(Number(v.total_cost) * 100) / 100,
        avgKwhPerSession: Math.round(Number(v.avg_kwh_per_session || 0) * 100) / 100,
        totalChargingHours: Math.round(Number(v.total_charging_min || 0) / 60 * 10) / 10,
      })),
    };
  }

  async getCarbonSavings(filters: AnalyticsFilterDto): Promise<CarbonSavings> {
    this.logger.debug('Computing carbon savings');
    const { start, end } = this.resolveDateRange(filters);
    const stationFilter = filters.stationId ? `AND cs.station_id = $3` : '';
    const params: any[] = [start, end];
    if (filters.stationId) params.push(filters.stationId);

    const energyResult = await this.dataSource.query(
      `SELECT COALESCE(SUM(energy_delivered_kwh), 0) as total_kwh
       FROM charging_sessions cs
       WHERE status = 'completed' AND started_at BETWEEN $1 AND $2 ${stationFilter}`,
      params,
    );

    const totalKwh = Number(energyResult[0]?.total_kwh || 0);

    // CO2 saved = energy delivered * India grid emission factor
    const co2SavedKg = Math.round(totalKwh * this.GRID_EMISSION_FACTOR * 100) / 100;

    // Equivalent distance driven by EVs
    const distanceKm = Math.round(totalKwh * this.EV_EFFICIENCY_KM_PER_KWH);

    // Fuel saved = distance / fuel efficiency of petrol car
    const fuelSavedLitres = Math.round(distanceKm * this.PETROL_CONSUMPTION_L_PER_KM * 100) / 100;

    // Trees equivalent: average tree absorbs ~21 kg CO2/year => daily absorption ~0.0575 kg
    const treesEquivalent = Math.round(co2SavedKg / 21);

    // Annual CO2 savings target (configurable)
    const co2SavingsTarget = this.configService.get<number>('CO2_SAVINGS_TARGET_KG', 100000);
    const achievementPercent =
      co2SavingsTarget > 0
        ? Math.round((co2SavedKg / co2SavingsTarget) * 100 * 10) / 10
        : 0;

    return {
      co2SavedKg,
      treesEquivalent,
      fuelSavedLitres,
      distanceEquivalentKm: distanceKm,
      co2SavingsTarget,
      achievementPercent,
    };
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    this.logger.debug('Fetching dashboard summary');
    const todayStart = moment().startOf('day').toDate();
    const monthStart = moment().startOf('month').toDate();
    const now = new Date();

    const [stations, activeChargers, activeSessions, todayStats, monthStats, totalUsers, alerts] =
      await Promise.all([
        this.dataSource.query(
          `SELECT COUNT(*) as count FROM stations WHERE is_active = true`,
        ),
        this.dataSource.query(
          `SELECT COUNT(*) as count FROM chargers WHERE status = 'available' OR status = 'charging'`,
        ),
        this.dataSource.query(
          `SELECT COUNT(*) as count FROM charging_sessions WHERE status = 'active'`,
        ),
        this.dataSource.query(
          `SELECT
             COALESCE(SUM(p.amount), 0) as revenue,
             COALESCE(SUM(cs.energy_delivered_kwh), 0) as kwh,
             COUNT(DISTINCT cs.id) as sessions
           FROM payments p
           LEFT JOIN charging_sessions cs ON p.session_id = cs.id
           WHERE p.status = 'completed' AND p.created_at >= $1`,
          [todayStart],
        ),
        this.dataSource.query(
          `SELECT
             COALESCE(SUM(p.amount), 0) as revenue,
             COALESCE(SUM(cs.energy_delivered_kwh), 0) as kwh
           FROM payments p
           LEFT JOIN charging_sessions cs ON p.session_id = cs.id
           WHERE p.status = 'completed' AND p.created_at >= $1`,
          [monthStart],
        ),
        this.dataSource.query(`SELECT COUNT(*) as count FROM users`),
        this.dataSource.query(
          `SELECT type, message, station_id, created_at as timestamp
           FROM station_alerts
           WHERE resolved = false AND created_at >= $1
           ORDER BY created_at DESC
           LIMIT 5`,
          [moment().subtract(24, 'hours').toDate()],
        ),
      ]);

    // Avg utilization across all stations
    const utilizationResult = await this.dataSource.query(
      `SELECT
         AVG(utilization_percent) as avg_utilization
       FROM (
         SELECT
           cs.station_id,
           (SUM(EXTRACT(EPOCH FROM (cs.ended_at - cs.started_at)) / 3600) /
            NULLIF(COUNT(DISTINCT cs.charger_id) * 24, 0)) * 100 as utilization_percent
         FROM charging_sessions cs
         WHERE cs.started_at >= $1 AND cs.status = 'completed'
         GROUP BY cs.station_id
       ) sub`,
      [todayStart],
    );

    return {
      totalStations: Number(stations[0]?.count || 0),
      activeChargers: Number(activeChargers[0]?.count || 0),
      activeSessions: Number(activeSessions[0]?.count || 0),
      todayRevenue: Math.round(Number(todayStats[0]?.revenue || 0) * 100) / 100,
      todayKwh: Math.round(Number(todayStats[0]?.kwh || 0) * 100) / 100,
      todaySessions: Number(todayStats[0]?.sessions || 0),
      monthRevenue: Math.round(Number(monthStats[0]?.revenue || 0) * 100) / 100,
      monthKwh: Math.round(Number(monthStats[0]?.kwh || 0) * 100) / 100,
      totalUsers: Number(totalUsers[0]?.count || 0),
      avgStationUtilization:
        Math.round(Number(utilizationResult[0]?.avg_utilization || 0) * 10) / 10,
      recentAlerts: alerts.map((a) => ({
        type: a.type,
        message: a.message,
        stationId: a.station_id,
        timestamp: a.timestamp,
      })),
    };
  }

  async getDemandForecast(
    stationId: string,
    hoursAhead: number = 24,
  ): Promise<DemandForecast> {
    this.logger.debug(`Generating demand forecast for station ${stationId}, ${hoursAhead}h ahead`);

    // Collect historical hourly session data for the same weekday over the last 4 weeks
    const historicalData = await this.dataSource.query(
      `SELECT
         EXTRACT(HOUR FROM started_at) as hour,
         EXTRACT(DOW FROM started_at) as day_of_week,
         COUNT(*) as session_count
       FROM charging_sessions
       WHERE station_id = $1
         AND started_at >= NOW() - INTERVAL '28 days'
         AND status IN ('completed', 'active')
       GROUP BY EXTRACT(HOUR FROM started_at), EXTRACT(DOW FROM started_at)
       ORDER BY day_of_week, hour`,
      [stationId],
    );

    // Build lookup: dayOfWeek -> hour -> avg sessions (simple moving average)
    const lookup: Map<string, number[]> = new Map();
    for (const row of historicalData) {
      const key = `${row.day_of_week}:${row.hour}`;
      if (!lookup.has(key)) lookup.set(key, []);
      lookup.get(key).push(Number(row.session_count));
    }

    const forecasts: DemandForecast['forecasts'] = [];
    let currentTime = moment();

    for (let i = 0; i < hoursAhead; i++) {
      const futureTime = currentTime.clone().add(i, 'hours');
      const key = `${futureTime.day()}:${futureTime.hour()}`;
      const historical = lookup.get(key) || [];

      // Simple moving average
      const historicalAvg =
        historical.length > 0
          ? historical.reduce((a, b) => a + b, 0) / historical.length
          : 0;

      // Weighted: recent data weighted more (simple linear weighting)
      const weightedAvg =
        historical.length > 1
          ? historical.reduce((sum, val, idx) => sum + val * (idx + 1), 0) /
            historical.reduce((sum, _, idx) => sum + (idx + 1), 0)
          : historicalAvg;

      // Confidence based on data points available
      const confidence =
        historical.length >= 4 ? 0.85 : historical.length >= 2 ? 0.65 : 0.40;

      forecasts.push({
        timestamp: futureTime.toDate(),
        predictedSessions: Math.max(0, Math.round(weightedAvg * 10) / 10),
        confidence,
        historicalAvg: Math.round(historicalAvg * 10) / 10,
      });
    }

    return { stationId, forecasts };
  }
}
