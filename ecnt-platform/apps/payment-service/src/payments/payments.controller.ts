import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentDto,
  VerifyPaymentDto,
  RefundDto,
  PaginationDto,
  CreateCorporatePaymentDto,
} from './dto/create-payment.dto';

// Guard placeholder - integrate with your auth service
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a payment order',
    description:
      'Creates a Razorpay order or processes wallet payment. Returns order details for frontend SDK integration.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment order created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid payment details' })
  async createOrder(@Request() req, @Body() dto: CreatePaymentDto) {
    const userId = req.user.id;
    return this.paymentsService.createOrder(userId, dto);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify Razorpay payment',
    description:
      'Verifies payment signature and marks the payment as completed.',
  })
  @ApiResponse({ status: 200, description: 'Payment verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid payment signature' })
  async verifyPayment(@Request() req, @Body() dto: VerifyPaymentDto) {
    const userId = req.user.id;
    return this.paymentsService.verifyPayment(userId, dto);
  }

  @Post('refund/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process a refund',
    description: 'Initiates a full or partial refund for a completed payment.',
  })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Refund processed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot refund this payment' })
  async processRefund(
    @Request() req,
    @Param('id') paymentId: string,
    @Body() dto: RefundDto,
  ) {
    const userId = req.user.id;
    return this.paymentsService.processRefund(userId, paymentId, dto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get payment history',
    description: 'Returns paginated payment history for the authenticated user.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Payment history retrieved' })
  async getPaymentHistory(
    @Request() req,
    @Query() pagination: PaginationDto,
  ) {
    const userId = req.user.id;
    return this.paymentsService.getPaymentHistory(userId, pagination);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment details' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Payment details retrieved' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentById(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.paymentsService.getPaymentById(id, userId);
  }

  @Post('corporate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create corporate / fleet payment',
    description: 'Initiates batch billing for a fleet account.',
  })
  @ApiResponse({ status: 201, description: 'Corporate payment created' })
  async createCorporatePayment(
    @Request() req,
    @Body() dto: CreateCorporatePaymentDto,
  ) {
    return this.paymentsService.createCorporatePayment(dto, req.user.id);
  }

  @Post('webhook/razorpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Razorpay webhook endpoint',
    description:
      'Public endpoint for Razorpay payment lifecycle events. No auth required.',
  })
  @ApiResponse({ status: 200, description: 'Webhook received' })
  async handleWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Body() body: any,
  ) {
    this.logger.log(`Received Razorpay webhook: ${body?.event}`);
    return this.paymentsService.handleWebhook(signature, body);
  }
}
