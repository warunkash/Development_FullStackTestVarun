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
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { TopUpDto, TransferDto, WalletTransactionFilterDto } from './dto/wallet.dto';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';

@ApiTags('wallets')
@Controller('wallets')
@UseGuards(new JwtAuthGuard(new Reflector()))
@ApiBearerAuth('JWT-auth')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiResponse({ status: 200, description: 'Wallet balance' })
  async getBalance(@Request() req: any) {
    return this.walletsService.getBalance(req.user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiResponse({ status: 200, description: 'Paginated transaction history' })
  async getTransactions(
    @Request() req: any,
    @Query() filterDto: WalletTransactionFilterDto,
  ) {
    return this.walletsService.getTransactions(req.user.id, filterDto);
  }

  @Post('top-up')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Top up wallet' })
  @ApiResponse({ status: 200, description: 'Wallet topped up' })
  @ApiResponse({ status: 400, description: 'Invalid amount or max balance exceeded' })
  async topUp(@Request() req: any, @Body() dto: TopUpDto) {
    return this.walletsService.topUp(req.user.id, dto);
  }

  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer funds to another user wallet' })
  @ApiResponse({ status: 200, description: 'Transfer completed' })
  async transfer(@Request() req: any, @Body() dto: TransferDto) {
    return this.walletsService.transfer(req.user.id, dto.toUserId, dto.amount);
  }
}
