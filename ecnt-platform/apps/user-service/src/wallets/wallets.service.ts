import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction, TransactionType, TransactionStatus } from './entities/wallet-transaction.entity';
import { TopUpDto, TransferDto, WalletTransactionFilterDto } from './dto/wallet.dto';

export interface PaginatedTransactions {
  data: WalletTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);
  private readonly MAX_WALLET_BALANCE = 100000; // INR 1 lakh max balance

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly transactionRepository: Repository<WalletTransaction>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createWallet(userId: string): Promise<Wallet> {
    const existing = await this.walletRepository.findOne({ where: { userId } });
    if (existing) throw new ConflictException('Wallet already exists for this user');

    const wallet = this.walletRepository.create({ userId, balance: 0 });
    return this.walletRepository.save(wallet);
  }

  async getWallet(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getBalance(userId: string): Promise<{ balance: number; currency: string }> {
    const wallet = await this.getWallet(userId);
    return { balance: wallet.balance, currency: 'INR' };
  }

  async getTransactions(
    userId: string,
    filterDto: WalletTransactionFilterDto,
  ): Promise<PaginatedTransactions> {
    const wallet = await this.getWallet(userId);
    const { page = 1, limit = 20, type, startDate, endDate } = filterDto;
    const skip = (page - 1) * limit;

    const query = this.transactionRepository
      .createQueryBuilder('tx')
      .where('tx.walletId = :walletId', { walletId: wallet.id })
      .orderBy('tx.createdAt', 'DESC');

    if (type) query.andWhere('tx.type = :type', { type });
    if (startDate) query.andWhere('tx.createdAt >= :startDate', { startDate: new Date(startDate) });
    if (endDate) query.andWhere('tx.createdAt <= :endDate', { endDate: new Date(endDate) });

    const [data, total] = await query.skip(skip).take(limit).getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async topUp(userId: string, dto: TopUpDto): Promise<WalletTransaction> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');
      if (!wallet.isActive) throw new BadRequestException('Wallet is suspended');

      if (wallet.balance + dto.amount > this.MAX_WALLET_BALANCE) {
        throw new BadRequestException(
          `Top-up would exceed maximum wallet balance of INR ${this.MAX_WALLET_BALANCE}`,
        );
      }

      const balanceBefore = wallet.balance;
      wallet.balance = parseFloat((wallet.balance + dto.amount).toFixed(2));
      wallet.totalToppedUp = parseFloat((wallet.totalToppedUp + dto.amount).toFixed(2));

      await manager.save(Wallet, wallet);

      const transaction = manager.create(WalletTransaction, {
        walletId: wallet.id,
        type: TransactionType.TOPUP,
        amount: dto.amount,
        balanceBefore,
        balanceAfter: wallet.balance,
        description: 'Wallet top-up',
        paymentId: dto.paymentId,
        status: TransactionStatus.COMPLETED,
        metadata: { gateway: dto.gateway },
      });

      const saved = await manager.save(WalletTransaction, transaction);
      this.eventEmitter.emit('wallet.toppedUp', { userId, amount: dto.amount });
      this.logger.log(`Wallet topped up for user ${userId}: INR ${dto.amount}`);
      return saved;
    });
  }

  async deduct(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
  ): Promise<WalletTransaction> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');
      if (!wallet.isActive) throw new BadRequestException('Wallet is suspended');
      if (wallet.balance < amount) {
        throw new BadRequestException(
          `Insufficient wallet balance. Available: INR ${wallet.balance}, Required: INR ${amount}`,
        );
      }

      const balanceBefore = wallet.balance;
      wallet.balance = parseFloat((wallet.balance - amount).toFixed(2));
      wallet.totalSpent = parseFloat((wallet.totalSpent + amount).toFixed(2));

      await manager.save(Wallet, wallet);

      const transaction = manager.create(WalletTransaction, {
        walletId: wallet.id,
        type: TransactionType.DEDUCTION,
        amount,
        balanceBefore,
        balanceAfter: wallet.balance,
        description,
        referenceId,
        status: TransactionStatus.COMPLETED,
      });

      const saved = await manager.save(WalletTransaction, transaction);
      this.eventEmitter.emit('wallet.deducted', { userId, amount, referenceId });
      return saved;
    });
  }

  async refund(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string,
  ): Promise<WalletTransaction> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const balanceBefore = wallet.balance;
      wallet.balance = parseFloat((wallet.balance + amount).toFixed(2));
      wallet.totalSpent = parseFloat(Math.max(0, wallet.totalSpent - amount).toFixed(2));

      await manager.save(Wallet, wallet);

      const transaction = manager.create(WalletTransaction, {
        walletId: wallet.id,
        type: TransactionType.REFUND,
        amount,
        balanceBefore,
        balanceAfter: wallet.balance,
        description,
        referenceId,
        status: TransactionStatus.COMPLETED,
      });

      const saved = await manager.save(WalletTransaction, transaction);
      this.eventEmitter.emit('wallet.refunded', { userId, amount, referenceId });
      this.logger.log(`Refund of INR ${amount} for user ${userId}, ref: ${referenceId}`);
      return saved;
    });
  }

  async transfer(fromUserId: string, toUserId: string, amount: number): Promise<{ from: WalletTransaction; to: WalletTransaction }> {
    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot transfer to the same wallet');
    }

    return this.dataSource.transaction(async (manager) => {
      // Lock both wallets in consistent order to prevent deadlock
      const [fromWallet, toWallet] = await Promise.all([
        manager.findOne(Wallet, { where: { userId: fromUserId }, lock: { mode: 'pessimistic_write' } }),
        manager.findOne(Wallet, { where: { userId: toUserId }, lock: { mode: 'pessimistic_write' } }),
      ]);

      if (!fromWallet) throw new NotFoundException('Source wallet not found');
      if (!toWallet) throw new NotFoundException('Destination wallet not found');
      if (fromWallet.balance < amount) {
        throw new BadRequestException('Insufficient balance for transfer');
      }

      const fromBefore = fromWallet.balance;
      const toBefore = toWallet.balance;

      fromWallet.balance = parseFloat((fromWallet.balance - amount).toFixed(2));
      toWallet.balance = parseFloat((toWallet.balance + amount).toFixed(2));

      await manager.save(Wallet, [fromWallet, toWallet]);

      const fromTx = manager.create(WalletTransaction, {
        walletId: fromWallet.id,
        type: TransactionType.TRANSFER_OUT,
        amount,
        balanceBefore: fromBefore,
        balanceAfter: fromWallet.balance,
        description: `Transfer to user ${toUserId}`,
        referenceId: toUserId,
        status: TransactionStatus.COMPLETED,
      });

      const toTx = manager.create(WalletTransaction, {
        walletId: toWallet.id,
        type: TransactionType.TRANSFER_IN,
        amount,
        balanceBefore: toBefore,
        balanceAfter: toWallet.balance,
        description: `Transfer from user ${fromUserId}`,
        referenceId: fromUserId,
        status: TransactionStatus.COMPLETED,
      });

      const [savedFrom, savedTo] = await manager.save(WalletTransaction, [fromTx, toTx]);
      this.eventEmitter.emit('wallet.transferred', { fromUserId, toUserId, amount });
      this.logger.log(`Wallet transfer: INR ${amount} from ${fromUserId} to ${toUserId}`);
      return { from: savedFrom, to: savedTo };
    });
  }
}
