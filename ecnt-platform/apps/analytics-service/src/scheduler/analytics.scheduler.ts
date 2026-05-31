import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as moment from 'moment';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsFilterDto, AnalyticsPeriod } from '../analytics/dto/analytics-filter.dto';

@Injectable()
export class AnalyticsScheduler {
  private readonly logger = new Logger(AnalyticsScheduler.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Every hour: cache station analytics metrics in Redis for dashboard speed
   */
  @Cron(CronExpression.EVERY_HOUR)
  async updateStationAnalyticsCache(): Promise<void> {
    this.logger.log('Cron: Updating station analytics cache...');
    try {
      const stations = await this.dataSource.query(
        `SELECT id FROM stations WHERE is_active = true`,
      );

      for (const station of stations) {
        const filters: AnalyticsFilterDto = {
          period: AnalyticsPeriod.LAST_7_DAYS,
          stationId: station.id,
        };

        const [energy, sessions, utilization] = await Promise.all([
          this.analyticsService.getEnergyMetrics(filters),
          this.analyticsService.getSessionMetrics(filters),
          this.analyticsService.getUtilizationMetrics(station.id, filters),
        ]);

        // Persist summary into station_analytics_cache table
        await this.dataSource.query(
          `INSERT INTO station_analytics_cache
             (station_id, cache_key, value, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (station_id, cache_key)
           DO UPDATE SET value = $3, updated_at = NOW()`,
          [
            station.id,
            'weekly_summary',
            JSON.stringify({ energy, sessions, utilization }),
          ],
        );
      }

      this.logger.log(`Station analytics cache updated for ${stations.length} stations`);
    } catch (error) {
      this.logger.error(`Cache update failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Daily at midnight: generate and store daily reports for all active stations
   */
  @Cron('0 0 * * *') // midnight every day
  async generateDailyReports(): Promise<void> {
    const yesterday = moment().subtract(1, 'day');
    this.logger.log(`Cron: Generating daily reports for ${yesterday.format('YYYY-MM-DD')}`);

    try {
      const stations = await this.dataSource.query(
        `SELECT id, name FROM stations WHERE is_active = true`,
      );

      let successCount = 0;
      let failCount = 0;

      for (const station of stations) {
        try {
          const filters: AnalyticsFilterDto = {
            period: AnalyticsPeriod.YESTERDAY,
            stationId: station.id,
          };

          const [revenue, energy, sessions] = await Promise.all([
            this.analyticsService.getRevenueMetrics(filters),
            this.analyticsService.getEnergyMetrics(filters),
            this.analyticsService.getSessionMetrics(filters),
          ]);

          // Store daily snapshot
          await this.dataSource.query(
            `INSERT INTO daily_station_snapshots
               (station_id, report_date, total_revenue, total_kwh, total_sessions,
                completed_sessions, avg_duration_min, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (station_id, report_date) DO UPDATE
             SET total_revenue = $3, total_kwh = $4, total_sessions = $5,
                 completed_sessions = $6, avg_duration_min = $7, created_at = NOW()`,
            [
              station.id,
              yesterday.format('YYYY-MM-DD'),
              revenue.total,
              energy.totalKwh,
              sessions.total,
              sessions.completed,
              sessions.avgDurationMin,
            ],
          );

          successCount++;
        } catch (err) {
          this.logger.error(
            `Daily report failed for station ${station.id}: ${err.message}`,
          );
          failCount++;
        }
      }

      this.logger.log(
        `Daily reports: ${successCount} succeeded, ${failCount} failed`,
      );
    } catch (error) {
      this.logger.error(`Daily report cron failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Weekly on Sundays at 6am: calculate and store carbon credit certificates
   */
  @Cron('0 6 * * 0') // 6am every Sunday
  async calculateWeeklyCarbonCredits(): Promise<void> {
    this.logger.log('Cron: Calculating weekly carbon credits...');

    try {
      const filters: AnalyticsFilterDto = { period: AnalyticsPeriod.LAST_7_DAYS };
      const carbon = await this.analyticsService.getCarbonSavings(filters);

      const weekEnd = moment().format('YYYY-MM-DD');
      const weekStart = moment().subtract(7, 'days').format('YYYY-MM-DD');

      await this.dataSource.query(
        `INSERT INTO carbon_credit_records
           (week_start, week_end, co2_saved_kg, trees_equivalent,
            fuel_saved_litres, distance_equivalent_km, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (week_start) DO UPDATE
         SET co2_saved_kg = $3, trees_equivalent = $4,
             fuel_saved_litres = $5, distance_equivalent_km = $6`,
        [
          weekStart,
          weekEnd,
          carbon.co2SavedKg,
          carbon.treesEquivalent,
          carbon.fuelSavedLitres,
          carbon.distanceEquivalentKm,
        ],
      );

      this.logger.log(
        `Carbon credits recorded: ${carbon.co2SavedKg} kg CO2 saved this week`,
      );
    } catch (error) {
      this.logger.error(`Carbon credit calculation failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Monthly on 1st at 2am: generate billing summaries for all fleet accounts
   */
  @Cron('0 2 1 * *') // 2am on the 1st of each month
  async generateMonthlyBillingSummaries(): Promise<void> {
    const lastMonth = moment().subtract(1, 'month');
    const year = lastMonth.year();
    const month = lastMonth.month() + 1;

    this.logger.log(`Cron: Generating monthly billing summaries for ${lastMonth.format('MMMM YYYY')}`);

    try {
      const fleetAccounts = await this.dataSource.query(
        `SELECT id, company_name, billing_email FROM fleet_accounts WHERE is_active = true`,
      );

      let successCount = 0;

      for (const account of fleetAccounts) {
        try {
          const filters: AnalyticsFilterDto = {
            period: AnalyticsPeriod.CUSTOM,
            startDate: lastMonth.clone().startOf('month').format('YYYY-MM-DD'),
            endDate: lastMonth.clone().endOf('month').format('YYYY-MM-DD'),
          };

          const fleetMetrics = await this.analyticsService.getFleetMetrics(
            account.id,
            filters,
          );

          await this.dataSource.query(
            `INSERT INTO monthly_fleet_billing_summaries
               (fleet_account_id, billing_month, total_sessions, total_kwh,
                total_amount, active_vehicles, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (fleet_account_id, billing_month) DO UPDATE
             SET total_sessions = $3, total_kwh = $4,
                 total_amount = $5, active_vehicles = $6`,
            [
              account.id,
              `${year}-${String(month).padStart(2, '0')}`,
              fleetMetrics.summary.totalSessions,
              fleetMetrics.summary.totalKwh,
              fleetMetrics.summary.totalCost,
              fleetMetrics.summary.activeVehicles,
            ],
          );

          successCount++;
        } catch (err) {
          this.logger.error(
            `Monthly billing failed for fleet ${account.id}: ${err.message}`,
          );
        }
      }

      this.logger.log(
        `Monthly billing summaries generated for ${successCount}/${fleetAccounts.length} fleet accounts`,
      );
    } catch (error) {
      this.logger.error(`Monthly billing cron failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Every 5 minutes: detect chargers with unusually long idle times and alert
   */
  @Cron('*/5 * * * *')
  async detectIdleChargerAlerts(): Promise<void> {
    try {
      const idleThresholdMinutes = 120; // 2 hours idle
      const idleChargers = await this.dataSource.query(
        `SELECT c.id as charger_id, c.station_id, c.name,
                EXTRACT(EPOCH FROM (NOW() - c.last_session_end)) / 60 as idle_minutes
         FROM chargers c
         WHERE c.status = 'available'
           AND c.last_session_end IS NOT NULL
           AND c.last_session_end < NOW() - INTERVAL '${idleThresholdMinutes} minutes'
           AND NOT EXISTS (
             SELECT 1 FROM station_alerts sa
             WHERE sa.charger_id = c.id
               AND sa.type = 'IDLE_CHARGER'
               AND sa.resolved = false
               AND sa.created_at > NOW() - INTERVAL '2 hours'
           )`,
      );

      for (const charger of idleChargers) {
        await this.dataSource.query(
          `INSERT INTO station_alerts (charger_id, station_id, type, message, resolved, created_at)
           VALUES ($1, $2, 'IDLE_CHARGER', $3, false, NOW())`,
          [
            charger.charger_id,
            charger.station_id,
            `Charger ${charger.name} has been idle for ${Math.round(charger.idle_minutes)} minutes`,
          ],
        );
      }

      if (idleChargers.length > 0) {
        this.logger.warn(`Idle charger alerts created for ${idleChargers.length} chargers`);
      }
    } catch (error) {
      // Silently handle - this runs every 5 min and table may not exist in dev
      this.logger.debug(`Idle charger check skipped: ${error.message}`);
    }
  }
}
