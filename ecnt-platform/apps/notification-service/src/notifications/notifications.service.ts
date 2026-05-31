import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';
import * as twilio from 'twilio';
import {
  NotificationEntity,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from './notification.entity';
import { PushTokenEntity } from './push-token.entity';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private twilioClient: twilio.Twilio;
  private firebaseInitialized = false;

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(PushTokenEntity)
    private readonly pushTokenRepo: Repository<PushTokenEntity>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.initFirebase();
    this.initTwilio();
    this.initSendGrid();
  }

  private initFirebase() {
    try {
      const serviceAccountJson = this.configService.get('FIREBASE_SERVICE_ACCOUNT_JSON');
      if (serviceAccountJson && !admin.apps.length) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        this.firebaseInitialized = true;
        this.logger.log('Firebase Admin initialized successfully');
      } else if (!admin.apps.length) {
        this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled');
      } else {
        this.firebaseInitialized = true;
      }
    } catch (err) {
      this.logger.error(`Firebase init error: ${err.message}`);
    }
  }

  private initTwilio() {
    try {
      const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
      const authToken = this.configService.get('TWILIO_AUTH_TOKEN');
      if (accountSid && authToken) {
        this.twilioClient = twilio(accountSid, authToken);
        this.logger.log('Twilio client initialized');
      } else {
        this.logger.warn('Twilio credentials not set — SMS notifications disabled');
      }
    } catch (err) {
      this.logger.error(`Twilio init error: ${err.message}`);
    }
  }

  private initSendGrid() {
    const apiKey = this.configService.get('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log('SendGrid initialized');
    } else {
      this.logger.warn('SENDGRID_API_KEY not set — email notifications disabled');
    }
  }

  private async getPushTokens(userId: string): Promise<string[]> {
    const tokens = await this.pushTokenRepo.find({
      where: { userId, isActive: true },
    });
    return tokens.map((t) => t.fcmToken).filter(Boolean);
  }

  async registerPushToken(
    userId: string,
    fcmToken: string,
    platform?: string,
    deviceId?: string,
  ): Promise<PushTokenEntity> {
    // Deactivate old tokens from the same device
    if (deviceId) {
      await this.pushTokenRepo.update(
        { userId, deviceId },
        { isActive: false },
      );
    }

    const existing = await this.pushTokenRepo.findOne({
      where: { userId, fcmToken },
    });

    if (existing) {
      existing.isActive = true;
      existing.lastUsed = new Date();
      return this.pushTokenRepo.save(existing);
    }

    const token = this.pushTokenRepo.create({
      userId,
      fcmToken,
      platform,
      deviceId,
      isActive: true,
      lastUsed: new Date(),
    });
    return this.pushTokenRepo.save(token);
  }

  async sendPush(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    notificationType: NotificationType = NotificationType.SYSTEM,
  ): Promise<{ success: boolean; failedCount: number; successCount: number }> {
    const tokens = await this.getPushTokens(userId);

    const notificationRecord = this.notificationRepo.create({
      userId,
      title,
      body,
      channel: NotificationChannel.PUSH,
      type: notificationType,
      status: NotificationStatus.PENDING,
      data,
    });
    await this.notificationRepo.save(notificationRecord);

    if (!this.firebaseInitialized || tokens.length === 0) {
      this.logger.warn(
        `No push tokens for user ${userId} or Firebase not initialized`,
      );
      notificationRecord.status = NotificationStatus.FAILED;
      notificationRecord.errorMessage = tokens.length === 0
        ? 'No registered push tokens'
        : 'Firebase not initialized';
      await this.notificationRepo.save(notificationRecord);
      return { success: false, failedCount: 1, successCount: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        notification: { title, body },
        data: data || {},
        tokens,
      };
      const result = await admin.messaging().sendEachForMulticast(message);

      // Invalidate tokens that are no longer registered
      result.responses.forEach(async (resp, idx) => {
        if (
          !resp.success &&
          resp.error?.code === 'messaging/registration-token-not-registered'
        ) {
          await this.pushTokenRepo.update(
            { fcmToken: tokens[idx] },
            { isActive: false },
          );
        }
      });

      notificationRecord.status =
        result.successCount > 0
          ? NotificationStatus.SENT
          : NotificationStatus.FAILED;
      notificationRecord.sentAt = new Date();
      await this.notificationRepo.save(notificationRecord);

      return {
        success: result.successCount > 0,
        successCount: result.successCount,
        failedCount: result.failureCount,
      };
    } catch (err) {
      this.logger.error(`Push notification failed for user ${userId}: ${err.message}`);
      notificationRecord.status = NotificationStatus.FAILED;
      notificationRecord.errorMessage = err.message;
      await this.notificationRepo.save(notificationRecord);
      return { success: false, failedCount: tokens.length, successCount: 0 };
    }
  }

  async sendSms(
    phone: string,
    message: string,
    userId?: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    const notificationRecord = this.notificationRepo.create({
      userId: userId || 'system',
      title: 'SMS',
      body: message,
      channel: NotificationChannel.SMS,
      type: NotificationType.SYSTEM,
      status: NotificationStatus.PENDING,
    });
    await this.notificationRepo.save(notificationRecord);

    if (!this.twilioClient) {
      this.logger.warn('Twilio not initialized — skipping SMS');
      notificationRecord.status = NotificationStatus.FAILED;
      notificationRecord.errorMessage = 'Twilio not initialized';
      await this.notificationRepo.save(notificationRecord);
      return { success: false };
    }

    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.configService.get('TWILIO_PHONE_NUMBER'),
        to: phone,
      });

      notificationRecord.status = NotificationStatus.SENT;
      notificationRecord.sentAt = new Date();
      notificationRecord.externalId = result.sid;
      await this.notificationRepo.save(notificationRecord);

      return { success: true, messageId: result.sid };
    } catch (err) {
      this.logger.error(`SMS failed to ${phone}: ${err.message}`);
      notificationRecord.status = NotificationStatus.FAILED;
      notificationRecord.errorMessage = err.message;
      await this.notificationRepo.save(notificationRecord);
      return { success: false };
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
    templateId?: string,
    userId?: string,
  ): Promise<{ success: boolean }> {
    const notificationRecord = this.notificationRepo.create({
      userId: userId || 'system',
      title: subject,
      body: htmlContent.substring(0, 500),
      channel: NotificationChannel.EMAIL,
      type: NotificationType.SYSTEM,
      status: NotificationStatus.PENDING,
    });
    await this.notificationRepo.save(notificationRecord);

    const sendGridKey = this.configService.get('SENDGRID_API_KEY');
    if (!sendGridKey) {
      this.logger.warn('SendGrid not initialized — skipping email');
      notificationRecord.status = NotificationStatus.FAILED;
      notificationRecord.errorMessage = 'SendGrid not initialized';
      await this.notificationRepo.save(notificationRecord);
      return { success: false };
    }

    try {
      const msg: sgMail.MailDataRequired = {
        to,
        from: {
          email: this.configService.get('SENDGRID_FROM_EMAIL', 'noreply@ecnt.in'),
          name: 'ECNT - EV Charge Network Telangana',
        },
        subject,
        html: htmlContent,
        ...(templateId && { templateId }),
      };
      await sgMail.send(msg);

      notificationRecord.status = NotificationStatus.SENT;
      notificationRecord.sentAt = new Date();
      await this.notificationRepo.save(notificationRecord);

      return { success: true };
    } catch (err) {
      this.logger.error(`Email failed to ${to}: ${err.message}`);
      notificationRecord.status = NotificationStatus.FAILED;
      notificationRecord.errorMessage = err.message;
      await this.notificationRepo.save(notificationRecord);
      return { success: false };
    }
  }

  // ---------- Notification Templates ----------

  async sendChargingStartedNotification(
    userId: string,
    sessionData: {
      sessionId: string;
      vehicleName: string;
      stationName: string;
      chargerId: string;
    },
  ): Promise<void> {
    await this.sendPush(
      userId,
      'Charging Started',
      `Your ${sessionData.vehicleName} is now charging at ${sessionData.stationName}`,
      {
        sessionId: sessionData.sessionId,
        type: 'charging_started',
        chargerId: sessionData.chargerId,
      },
      NotificationType.CHARGING_STARTED,
    );
    this.logger.log(`Charging started notification sent to user ${userId}`);
  }

  async sendChargingCompleteNotification(
    userId: string,
    sessionData: {
      sessionId: string;
      vehicleName: string;
      stationName: string;
      energyKwh: number;
      amount: number;
      phone: string;
      invoiceId: string;
      durationMinutes: number;
    },
  ): Promise<void> {
    await this.sendPush(
      userId,
      'Charging Complete',
      `Charged ${sessionData.energyKwh} kWh in ${sessionData.durationMinutes} mins. Total cost: ₹${sessionData.amount}`,
      {
        sessionId: sessionData.sessionId,
        type: 'charging_complete',
        energyKwh: String(sessionData.energyKwh),
        amount: String(sessionData.amount),
      },
      NotificationType.CHARGING_COMPLETE,
    );

    await this.sendSms(
      sessionData.phone,
      `ECNT: Charging complete at ${sessionData.stationName}. ${sessionData.energyKwh} kWh delivered in ${sessionData.durationMinutes} mins. Amount: ₹${sessionData.amount}. Invoice: ${sessionData.invoiceId}`,
      userId,
    );
  }

  async sendPaymentConfirmation(
    userId: string,
    paymentData: {
      id: string;
      amount: number;
      method: string;
      walletBalance?: number;
    },
  ): Promise<void> {
    await this.sendPush(
      userId,
      'Payment Confirmed',
      `Payment of ₹${paymentData.amount} received via ${paymentData.method}${
        paymentData.walletBalance !== undefined
          ? `. Wallet balance: ₹${paymentData.walletBalance}`
          : ''
      }`,
      {
        paymentId: paymentData.id,
        type: 'payment_confirmed',
        amount: String(paymentData.amount),
      },
      NotificationType.PAYMENT_CONFIRMED,
    );
  }

  async sendPaymentFailedNotification(
    userId: string,
    paymentData: { id: string; amount: number; reason: string },
  ): Promise<void> {
    await this.sendPush(
      userId,
      'Payment Failed',
      `Payment of ₹${paymentData.amount} failed. Reason: ${paymentData.reason}. Please retry.`,
      {
        paymentId: paymentData.id,
        type: 'payment_failed',
      },
      NotificationType.PAYMENT_FAILED,
    );
  }

  async sendLowWalletAlert(userId: string, balance: number): Promise<void> {
    await this.sendPush(
      userId,
      'Low Wallet Balance',
      `Your wallet balance is ₹${balance}. Top up now to continue charging without interruption.`,
      { type: 'low_wallet', balance: String(balance) },
      NotificationType.LOW_WALLET,
    );
  }

  async sendMaintenanceAlert(
    technicianIds: string[],
    faultData: {
      stationName: string;
      stationId: string;
      chargerId: string;
      errorCode: string;
      ticketId: string;
      severity: string;
    },
  ): Promise<void> {
    const severity = faultData.severity?.toUpperCase() || 'UNKNOWN';
    for (const techId of technicianIds) {
      await this.sendPush(
        techId,
        `[${severity}] Charger Fault`,
        `Fault at ${faultData.stationName}: Error ${faultData.errorCode}. Charger: ${faultData.chargerId}`,
        {
          ticketId: faultData.ticketId,
          type: 'maintenance_alert',
          stationId: faultData.stationId,
          chargerId: faultData.chargerId,
          errorCode: faultData.errorCode,
        },
        NotificationType.MAINTENANCE_ALERT,
      );
    }
  }

  async sendOtp(phone: string, otp: string, userId?: string): Promise<void> {
    await this.sendSms(
      phone,
      `Your ECNT OTP is: ${otp}. Valid for 10 minutes. Do NOT share this with anyone. ECNT never asks for OTPs.`,
      userId,
    );
  }

  async sendWelcomeNotification(
    userId: string,
    userData: { name: string; email: string },
  ): Promise<void> {
    await this.sendPush(
      userId,
      'Welcome to ECNT!',
      `Hi ${userData.name}! Welcome to EV Charge Network Telangana. Find your nearest charging station now.`,
      { type: 'welcome' },
      NotificationType.WELCOME,
    );

    await this.sendEmail(
      userData.email,
      'Welcome to ECNT - EV Charge Network Telangana',
      `<h1>Welcome to ECNT, ${userData.name}!</h1>
      <p>Thank you for joining EV Charge Network Telangana. You now have access to our growing network of EV charging stations across Telangana.</p>
      <h2>Getting Started</h2>
      <ul>
        <li>Add your vehicle to get personalized recommendations</li>
        <li>Find charging stations near you</li>
        <li>Top up your ECNT wallet for seamless payments</li>
        <li>Track your charging history and carbon savings</li>
      </ul>
      <p>If you need any help, contact us at support@ecnt.in</p>
      <p>Happy Charging!<br/>Team ECNT</p>`,
      undefined,
      userId,
    );
  }

  async sendMaintenanceTicketCreatedNotification(
    userId: string,
    ticketData: {
      ticketId: string;
      stationName: string;
      issueDescription: string;
    },
  ): Promise<void> {
    await this.sendPush(
      userId,
      'Support Ticket Created',
      `Your maintenance ticket #${ticketData.ticketId} for ${ticketData.stationName} has been created. Our team will resolve it shortly.`,
      {
        ticketId: ticketData.ticketId,
        type: 'ticket_created',
      },
      NotificationType.TICKET_CREATED,
    );
  }

  // ---------- Query / Management ----------

  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false,
  ): Promise<{ data: NotificationEntity[]; total: number; unreadCount: number }> {
    const skip = (page - 1) * limit;

    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .andWhere('n.channel IN (:...channels)', {
        channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
      });

    if (unreadOnly) {
      qb.andWhere('n.read_at IS NULL')
        .andWhere('n.status = :status', { status: NotificationStatus.SENT });
    }

    const [data, total] = await qb
      .orderBy('n.created_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const unreadCount = await this.notificationRepo.count({
      where: {
        userId,
        status: NotificationStatus.SENT,
      },
    });

    return { data, total, unreadCount };
  }

  async markAsRead(notificationId: string, userId: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found for user ${userId}`);
    }
    notification.status = NotificationStatus.READ;
    notification.readAt = new Date();
    return this.notificationRepo.save(notification);
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepo
      .createQueryBuilder()
      .update(NotificationEntity)
      .set({ status: NotificationStatus.READ, readAt: new Date() })
      .where('user_id = :userId AND status = :status', {
        userId,
        status: NotificationStatus.SENT,
      })
      .execute();
    return { updated: result.affected || 0 };
  }
}
