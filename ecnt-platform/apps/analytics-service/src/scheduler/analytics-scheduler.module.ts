import { Module } from '@nestjs/common';
import { AnalyticsScheduler } from './analytics.scheduler';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  providers: [AnalyticsScheduler],
})
export class AnalyticsSchedulerModule {}
