import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';

// Webhooks are handled directly in PaymentsController (/payments/webhook/razorpay)
// This module provides an extension point for additional webhook sources (e.g., Stripe, bank)
@Module({
  imports: [PaymentsModule],
  controllers: [],
  providers: [],
})
export class WebhooksModule {}
