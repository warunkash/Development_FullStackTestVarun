import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';

// Dashboard aggregation is handled by AnalyticsService.getDashboardSummary()
// This module is the extension point for real-time dashboard WebSocket integration
@Module({
  imports: [AnalyticsModule],
})
export class DashboardModule {}
