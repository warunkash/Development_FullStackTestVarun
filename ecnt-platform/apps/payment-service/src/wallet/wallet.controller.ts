import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

export class TopUpDto {
  @ApiProperty({ example: 500, description: 'Top-up amount in INR (min 100, max 100000)' })
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({ description: 'Payment ID from Razorpay after successful payment' })
  @IsString()
  paymentId: string;
}

@ApiTags('wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get wallet balance and summary' })
  @ApiResponse({ status: 200, description: 'Wallet summary retrieved' })
  async getBalance(@Request() req) {
    return this.walletService.getWalletSummary(req.user.id);
  }

  @Post('topup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Top up wallet balance',
    description: 'Credits wallet after a successful Razorpay payment. 2% cashback on top-ups >= ₹500.',
  })
  @ApiResponse({ status: 200, description: 'Wallet topped up successfully' })
  async topUp(@Request() req, @Body() dto: TopUpDto) {
    return this.walletService.topUp(req.user.id, dto.amount, dto.paymentId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Transaction history retrieved' })
  async getTransactions(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.walletService.getTransactionHistory(req.user.id, page, limit);
  }
}
