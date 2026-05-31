import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import { WalletEntity, WalletTransactionEntity, WalletTransactionType } from './wallet.entity';

export interface WalletSummary {
  balance: number;
  lockedBalance: number;
  availableBalance: number;
  currency: string;
  totalCredited: number;
  totalDebited: number;
  cashbackEarned: number;
  recentTransactions: WalletTransactionEntity[];
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,
    @InjectRepository(WalletTransactionEntity)
    private readonly transactionRepository: Repository<WalletTransactionEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async getOrCreateWallet(userId: string): Promise<WalletEntity> {
    let wallet = await this.walletRepository.findOne({ where: { userId } });
    if (!wallet) {
      wallet = this.walletRepository.create({
        userId,
        balance: 0,
        lockedBalance: 0,
        currency: 'INR',
        isActive: true,
        totalCredited: 0,
        totalDebited: 0,
        cashbackEarned: 0,
      });
      await this.walletRepository.save(wallet);
      this.logger.log(`Created new wallet for user ${userId}`);
    }
    return wallet;
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.walletRepository.findOne({ where: { userId } });
    if (!wallet) return 0;
    return Number(wallet.balance);
  }

  async getWalletSummary(userId: string): Promise<WalletSummary> {
    const wallet = await this.getOrCreateWallet(userId);
    const recentTransactions = await this.transactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      balance: Number(wallet.balance),
      lockedBalance: Number(wallet.lockedBalance),
      availableBalance: Number(wallet.balance) - Number(wallet.lockedBalance),
      currency: wallet.currency,
      totalCredited: Number(wallet.totalCredited),
      totalDebited: Number(wallet.totalDebited),
      cashbackEarned: Number(wallet.cashbackEarned),
      recentTransactions,
    };
  }

  async credit(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
    queryRunner?: QueryRunner,
    type: WalletTransactionType = WalletTransactionType.CREDIT,
  ): Promise<WalletTransactionEntity> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(WalletEntity)
      : this.walletRepository;
    const txRepo = queryRunner
      ? queryRunner.manager.getRepository(WalletTransactionEntity)
      : this.transactionRepository;

    const wallet = await repo.findOne({ where: { userId }, lock: { mode: 'pessimistic_write' } });

    if (!wallet) {
      throw new NotFoundException(`Wallet not found for user ${userId}`);
    }

    if (!wallet.isActive) {
      throw new BadRequestException('Wallet is deactivated');
    }

    const newBalance = Number(wallet.balance) + Number(amount);
    wallet.balance = newBalance;
    wallet.totalCredited = Number(wallet.totalCredited) + Number(amount);

    if (type === WalletTransactionType.CASHBACK || type === WalletTransactionType.BONUS) {
      wallet.cashbackEarned = Number(wallet.cashbackEarned) + Number(amount);
    }

    await repo.save(wallet);

    const transaction = txRepo.create({
      walletId: wallet.id,
      userId,
      type,
      amount,
      balanceAfter: newBalance,
      description,
      referenceId,
    });

    await txRepo.save(transaction);
    this.logger.log(`Credited ₹${amount} to wallet for user ${userId}. New balance: ₹${newBalance}`);
    return transaction;
  }

  async deduct(
    userId: string,
    amount: number,
    description: string,
    paymentId: string,
    queryRunner?: QueryRunner,
  ): Promise<WalletTransactionEntity> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(WalletEntity)
      : this.walletRepository;
    const txRepo = queryRunner
      ? queryRunner.manager.getRepository(WalletTransactionEntity)
      : this.transactionRepository;

    const wallet = await repo.findOne({ where: { userId }, lock: { mode: 'pessimistic_write' } });

    if (!wallet) {
      throw new NotFoundException(`Wallet not found for user ${userId}`);
    }

    if (!wallet.isActive) {
      throw new BadRequestException('Wallet is deactivated');
    }

    const available = Number(wallet.balance) - Number(wallet.lockedBalance);
    if (available < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ₹${available}, Required: ₹${amount}`,
      );
    }

    const newBalance = Number(wallet.balance) - Number(amount);
    wallet.balance = newBalance;
    wallet.totalDebited = Number(wallet.totalDebited) + Number(amount);

    await repo.save(wallet);

    const transaction = txRepo.create({
      walletId: wallet.id,
      userId,
      type: WalletTransactionType.DEBIT,
      amount,
      balanceAfter: newBalance,
      description,
      paymentId,
    });

    await txRepo.save(transaction);
    this.logger.log(`Debited ₹${amount} from wallet for user ${userId}. New balance: ₹${newBalance}`);
    return transaction;
  }

  async topUp(
    userId: string,
    amount: number,
    paymentId: string,
  ): Promise<WalletTransactionEntity> {
    if (amount < 100) {
      throw new BadRequestException('Minimum top-up amount is ₹100');
    }
    if (amount > 100000) {
      throw new BadRequestException('Maximum top-up amount is ₹1,00,000');
    }

    await this.getOrCreateWallet(userId);

    const transaction = await this.credit(
      userId,
      amount,
      `Wallet top-up via payment ${paymentId}`,
      paymentId,
      undefined,
      WalletTransactionType.TOPUP,
    );

    // Apply cashback for top-ups >= 500 (2% cashback)
    if (amount >= 500) {
      const cashbackAmount = Math.round(amount * 0.02 * 100) / 100;
      await this.credit(
        userId,
        cashbackAmount,
        `2% cashback on top-up of ₹${amount}`,
        paymentId,
        undefined,
        WalletTransactionType.CASHBACK,
      );
      this.logger.log(`Cashback of ₹${cashbackAmount} credited for user ${userId}`);
    }

    return transaction;
  }

  async getTransactionHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: WalletTransactionEntity[]; total: number; page: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.transactionRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total, page };
  }
}
