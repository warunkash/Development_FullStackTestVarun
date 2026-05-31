import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import {
  PaymentEntity,
  PaymentStatus,
  PaymentMethod,
  PaymentGateway,
  PaymentType,
} from './payment.entity';
import {
  CreatePaymentDto,
  VerifyPaymentDto,
  RefundDto,
  PaginationDto,
  CreateCorporatePaymentDto,
} from './dto/create-payment.dto';
import { WalletService } from '../wallet/wallet.service';
import { InvoicesService } from '../invoices/invoices.service';

export interface PaymentOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  paymentId: string;
  gateway: PaymentGateway;
}

export interface PaymentHistoryResponse {
  data: PaymentEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: Razorpay;

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly walletService: WalletService,
    private readonly invoicesService: InvoicesService,
    private readonly dataSource: DataSource,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.configService.getOrThrow('RAZORPAY_KEY_ID'),
      key_secret: this.configService.getOrThrow('RAZORPAY_KEY_SECRET'),
    });
  }

  async createOrder(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<PaymentOrderResponse> {
    this.logger.log(
      `Creating payment order for user ${userId}, amount ${dto.amount}, method ${dto.paymentMethod}`,
    );

    // Handle internal wallet payment
    if (dto.paymentMethod === PaymentMethod.WALLET) {
      return this.processWalletPayment(userId, dto);
    }

    // Create Razorpay order
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create pending payment record
      const payment = this.paymentRepository.create({
        userId,
        sessionId: dto.sessionId,
        amount: dto.amount,
        currency: 'INR',
        type: dto.type,
        status: PaymentStatus.PENDING,
        paymentMethod: dto.paymentMethod,
        gateway: PaymentGateway.RAZORPAY,
        description: dto.description,
        fleetAccountId: dto.fleetAccountId,
        taxAmount: this.calculateTax(dto.amount, dto.type),
        metadata: { sessionId: dto.sessionId, description: dto.description },
      });

      await queryRunner.manager.save(payment);

      // Create Razorpay order
      const razorpayOrder = await this.razorpay.orders.create({
        amount: Math.round(dto.amount * 100), // convert to paise
        currency: 'INR',
        receipt: `ECT_${payment.id.substring(0, 8)}_${Date.now()}`,
        notes: {
          paymentId: payment.id,
          userId,
          sessionId: dto.sessionId || '',
          type: dto.type,
        },
      });

      // Update payment with gateway order ID
      payment.gatewayOrderId = razorpayOrder.id;
      await queryRunner.manager.save(payment);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Razorpay order created: ${razorpayOrder.id} for payment ${payment.id}`,
      );

      return {
        orderId: razorpayOrder.id,
        amount: dto.amount,
        currency: 'INR',
        keyId: this.configService.get('RAZORPAY_KEY_ID'),
        paymentId: payment.id,
        gateway: PaymentGateway.RAZORPAY,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create order for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Payment order creation failed: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async processWalletPayment(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<PaymentOrderResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check wallet balance
      const balance = await this.walletService.getBalance(userId);
      if (balance < dto.amount) {
        throw new BadRequestException(
          `Insufficient wallet balance. Available: ₹${balance}, Required: ₹${dto.amount}`,
        );
      }

      // Create payment record
      const payment = this.paymentRepository.create({
        userId,
        sessionId: dto.sessionId,
        amount: dto.amount,
        currency: 'INR',
        type: dto.type,
        status: PaymentStatus.COMPLETED,
        paymentMethod: PaymentMethod.WALLET,
        gateway: PaymentGateway.INTERNAL_WALLET,
        completedAt: new Date(),
        taxAmount: this.calculateTax(dto.amount, dto.type),
        description: dto.description,
        metadata: { sessionId: dto.sessionId, walletPayment: true },
      });

      await queryRunner.manager.save(payment);

      // Deduct from wallet
      await this.walletService.deduct(
        userId,
        dto.amount,
        `Payment for ${dto.type}: ${dto.description || dto.sessionId}`,
        payment.id,
        queryRunner,
      );

      await queryRunner.commitTransaction();

      // Emit payment completed event
      this.eventEmitter.emit('payment.completed', {
        paymentId: payment.id,
        userId,
        amount: dto.amount,
        type: dto.type,
        sessionId: dto.sessionId,
      });

      this.logger.log(
        `Wallet payment completed: ${payment.id} for user ${userId}`,
      );

      return {
        orderId: payment.id,
        amount: dto.amount,
        currency: 'INR',
        keyId: '',
        paymentId: payment.id,
        gateway: PaymentGateway.INTERNAL_WALLET,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Wallet payment failed for user ${userId}: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async verifyPayment(userId: string, dto: VerifyPaymentDto): Promise<PaymentEntity> {
    this.logger.log(`Verifying payment: ${dto.razorpayPaymentId}`);

    // Verify Razorpay signature
    const keySecret = this.configService.getOrThrow('RAZORPAY_KEY_SECRET');
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== dto.razorpaySignature) {
      this.logger.warn(
        `Invalid payment signature for order ${dto.razorpayOrderId}`,
      );
      throw new UnauthorizedException('Invalid payment signature');
    }

    // Find payment record
    const payment = await this.paymentRepository.findOne({
      where: { gatewayOrderId: dto.razorpayOrderId, userId },
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment not found for order ${dto.razorpayOrderId}`,
      );
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return payment; // Idempotent - already verified
    }

    // Update payment as completed
    payment.status = PaymentStatus.COMPLETED;
    payment.gatewayPaymentId = dto.razorpayPaymentId;
    payment.gatewaySignature = dto.razorpaySignature;
    payment.completedAt = new Date();

    await this.paymentRepository.save(payment);

    // Emit payment completed event
    this.eventEmitter.emit('payment.completed', {
      paymentId: payment.id,
      userId,
      amount: payment.amount,
      type: payment.type,
      sessionId: payment.sessionId,
      gatewayPaymentId: dto.razorpayPaymentId,
    });

    // Generate invoice asynchronously
    this.generateInvoice(payment.id).catch((err) =>
      this.logger.error(`Invoice generation failed: ${err.message}`),
    );

    this.logger.log(
      `Payment verified successfully: ${payment.id} (₹${payment.amount})`,
    );
    return payment;
  }

  async processRefund(
    userId: string,
    paymentId: string,
    dto: RefundDto,
  ): Promise<PaymentEntity> {
    this.logger.log(
      `Processing refund for payment ${paymentId}: ₹${dto.amount}`,
    );

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot refund payment in status: ${payment.status}`,
      );
    }

    const existingRefund = payment.refundAmount || 0;
    const totalRefund = Number(existingRefund) + Number(dto.amount);

    if (totalRefund > Number(payment.amount)) {
      throw new BadRequestException(
        `Refund amount ₹${dto.amount} exceeds refundable amount ₹${Number(payment.amount) - Number(existingRefund)}`,
      );
    }

    if (payment.gateway === PaymentGateway.INTERNAL_WALLET) {
      // Credit back to wallet
      await this.walletService.credit(
        userId,
        dto.amount,
        `Refund for payment ${paymentId}: ${dto.reason || 'N/A'}`,
        paymentId,
      );
    } else {
      // Razorpay refund
      try {
        const refundResponse = await this.razorpay.payments.refund(
          payment.gatewayPaymentId,
          {
            amount: Math.round(dto.amount * 100),
            notes: {
              reason: dto.reason || 'Customer requested refund',
              paymentId,
              userId,
            },
          },
        );
        payment.razorpayRefundId = refundResponse.id;
      } catch (error) {
        this.logger.error(`Razorpay refund failed: ${error.message}`, error.stack);
        throw new BadRequestException(`Refund processing failed: ${error.message}`);
      }
    }

    // Update payment status
    payment.refundAmount = totalRefund;
    payment.refundedAt = new Date();
    payment.status =
      totalRefund >= Number(payment.amount)
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

    await this.paymentRepository.save(payment);

    this.eventEmitter.emit('payment.refunded', {
      paymentId: payment.id,
      userId,
      refundAmount: dto.amount,
      reason: dto.reason,
    });

    this.logger.log(`Refund processed: ₹${dto.amount} for payment ${paymentId}`);
    return payment;
  }

  async getPaymentHistory(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaymentHistoryResponse> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await this.paymentRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPaymentById(id: string, userId: string): Promise<PaymentEntity> {
    const payment = await this.paymentRepository.findOne({
      where: { id, userId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }

    return payment;
  }

  async handleWebhook(signature: string, body: any): Promise<{ received: boolean }> {
    // Verify webhook signature
    const webhookSecret = this.configService.get('RAZORPAY_WEBHOOK_SECRET');
    if (webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');

      if (expectedSignature !== signature) {
        this.logger.warn('Invalid webhook signature received');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const event = body.event;
    const payload = body.payload;

    this.logger.log(`Processing webhook event: ${event}`);

    switch (event) {
      case 'payment.captured': {
        const razorpayPayment = payload.payment?.entity;
        if (razorpayPayment) {
          const payment = await this.paymentRepository.findOne({
            where: { gatewayOrderId: razorpayPayment.order_id },
          });
          if (payment && payment.status !== PaymentStatus.COMPLETED) {
            payment.status = PaymentStatus.COMPLETED;
            payment.gatewayPaymentId = razorpayPayment.id;
            payment.completedAt = new Date();
            await this.paymentRepository.save(payment);
            this.eventEmitter.emit('payment.completed', {
              paymentId: payment.id,
              userId: payment.userId,
              amount: payment.amount,
              type: payment.type,
            });
          }
        }
        break;
      }

      case 'payment.failed': {
        const razorpayPayment = payload.payment?.entity;
        if (razorpayPayment) {
          const payment = await this.paymentRepository.findOne({
            where: { gatewayOrderId: razorpayPayment.order_id },
          });
          if (payment) {
            payment.status = PaymentStatus.FAILED;
            payment.failureReason =
              razorpayPayment.error_description || 'Payment failed';
            await this.paymentRepository.save(payment);
            this.eventEmitter.emit('payment.failed', {
              paymentId: payment.id,
              userId: payment.userId,
              reason: payment.failureReason,
            });
          }
        }
        break;
      }

      case 'refund.created': {
        const refund = payload.refund?.entity;
        if (refund) {
          const payment = await this.paymentRepository.findOne({
            where: { gatewayPaymentId: refund.payment_id },
          });
          if (payment) {
            payment.razorpayRefundId = refund.id;
            payment.refundedAt = new Date(refund.created_at * 1000);
            await this.paymentRepository.save(payment);
          }
        }
        break;
      }

      default:
        this.logger.debug(`Unhandled webhook event: ${event}`);
    }

    return { received: true };
  }

  async createCorporatePayment(
    dto: CreateCorporatePaymentDto,
    adminUserId: string,
  ): Promise<PaymentEntity> {
    this.logger.log(
      `Creating corporate payment for fleet ${dto.fleetAccountId}: ₹${dto.amount}`,
    );

    const payment = this.paymentRepository.create({
      userId: adminUserId,
      amount: dto.amount,
      currency: 'INR',
      type: PaymentType.FLEET_BILLING,
      status: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.CORPORATE,
      gateway: PaymentGateway.RAZORPAY,
      fleetAccountId: dto.fleetAccountId,
      taxAmount: this.calculateTax(dto.amount, PaymentType.FLEET_BILLING),
      metadata: {
        sessionIds: dto.sessionIds,
        sessionCount: dto.sessionIds.length,
        billingType: 'corporate_batch',
      },
    });

    await this.paymentRepository.save(payment);

    // Create Razorpay order for corporate billing
    const razorpayOrder = await this.razorpay.orders.create({
      amount: Math.round(dto.amount * 100),
      currency: 'INR',
      receipt: `FLEET_${dto.fleetAccountId.substring(0, 8)}_${Date.now()}`,
      notes: {
        paymentId: payment.id,
        fleetAccountId: dto.fleetAccountId,
        sessionCount: String(dto.sessionIds.length),
        type: PaymentType.FLEET_BILLING,
      },
    });

    payment.gatewayOrderId = razorpayOrder.id;
    await this.paymentRepository.save(payment);

    return payment;
  }

  async generateInvoice(paymentId: string): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    await this.invoicesService.createInvoiceForPayment(payment);
  }

  private calculateTax(amount: number, type: PaymentType): number {
    // EV charging: 5% GST (concessional)
    // Others: 18% GST
    const gstRate =
      type === PaymentType.CHARGING_SESSION ? 0.05 : 0.18;
    return Math.round(amount * gstRate * 100) / 100;
  }
}
