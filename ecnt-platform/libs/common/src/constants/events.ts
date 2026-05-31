export enum ServiceEvents {
  // Auth events
  USER_REGISTERED = 'user.registered',
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  PASSWORD_RESET = 'user.password_reset',
  EMAIL_VERIFIED = 'user.email_verified',
  PHONE_VERIFIED = 'user.phone_verified',

  // Charging events
  SESSION_STARTED = 'charging.session.started',
  SESSION_STOPPED = 'charging.session.stopped',
  SESSION_UPDATED = 'charging.session.updated',
  SESSION_FAILED = 'charging.session.failed',
  CHARGER_STATUS_CHANGED = 'charger.status.changed',
  CHARGER_FAULT = 'charger.fault',
  CHARGER_OFFLINE = 'charger.offline',
  CHARGER_ONLINE = 'charger.online',

  // OCPP events
  OCPP_BOOT_NOTIFICATION = 'ocpp.boot_notification',
  OCPP_HEARTBEAT = 'ocpp.heartbeat',
  OCPP_STATUS_NOTIFICATION = 'ocpp.status_notification',
  OCPP_METER_VALUES = 'ocpp.meter_values',
  OCPP_AUTHORIZE = 'ocpp.authorize',

  // Payment events
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  REFUND_INITIATED = 'payment.refund.initiated',
  REFUND_COMPLETED = 'payment.refund.completed',
  WALLET_TOPUP = 'payment.wallet.topup',
  WALLET_DEDUCTED = 'payment.wallet.deducted',

  // Notification events
  NOTIFICATION_SEND = 'notification.send',
  EMAIL_SEND = 'email.send',
  SMS_SEND = 'sms.send',
  PUSH_SEND = 'push.send',

  // Maintenance events
  TICKET_CREATED = 'maintenance.ticket.created',
  TICKET_UPDATED = 'maintenance.ticket.updated',
  TICKET_RESOLVED = 'maintenance.ticket.resolved',
  TICKET_ESCALATED = 'maintenance.ticket.escalated',

  // Fleet events
  FLEET_SESSION_STARTED = 'fleet.session.started',
  FLEET_SESSION_ENDED = 'fleet.session.ended',
  FLEET_POLICY_VIOLATED = 'fleet.policy.violated',
  FLEET_INVOICE_GENERATED = 'fleet.invoice.generated',

  // Analytics events
  STATION_ANALYTICS_UPDATED = 'analytics.station.updated',
  REVENUE_REPORT_GENERATED = 'analytics.revenue.generated',

  // Carbon credit events
  CARBON_CREDITS_EARNED = 'carbon.credits.earned',
  CARBON_CREDITS_VERIFIED = 'carbon.credits.verified',
}
