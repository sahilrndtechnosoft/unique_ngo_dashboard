import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ledger_entry_type,
  Prisma,
  reward_activity,
  reward_transaction_type,
  reward_wallets,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListLedgerEntriesQueryDto, ManualPointsAdjustmentDto } from '../dto/reward.dto';

export interface CreditActivityParams {
  userId: string;
  activity: reward_activity;
  referenceType: string;
  referenceId: string;
  performedById?: string;
  idempotencyKey?: string;
}

export function calculateTier(lifetimePoints: number): string {
  if (lifetimePoints >= 5000) return 'PLATINUM';
  if (lifetimePoints >= 1500) return 'GOLD';
  if (lifetimePoints >= 500) return 'SILVER';
  return 'BRONZE';
}

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Credits points for an activity based on the active reward_rules configuration.
   * Enforces validity windows, daily/monthly/lifetime limits, and atomic ledger creation.
   */
  async creditForActivity(params: CreditActivityParams) {
    const rule = await this.prisma.reward_rules.findUnique({
      where: { activity: params.activity },
    });

    if (!rule || !rule.is_active) {
      this.logger.warn(`No active reward rule found for activity: ${params.activity}`);
      return null;
    }

    const now = new Date();
    if (rule.valid_from && rule.valid_from > now) {
      this.logger.warn(`Rule for ${params.activity} is not yet effective`);
      return null;
    }
    if (rule.valid_until && rule.valid_until < now) {
      this.logger.warn(`Rule for ${params.activity} has expired`);
      return null;
    }

    // Check limits
    if (rule.max_per_day !== null || rule.max_per_month !== null || rule.max_lifetime !== null) {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [dayCount, monthCount, lifetimeCount] = await Promise.all([
        rule.max_per_day !== null
          ? this.prisma.reward_ledger_entries.count({
              where: {
                user_id: params.userId,
                rule_id: rule.id,
                entry_type: ledger_entry_type.CREDIT,
                created_at: { gte: startOfDay },
              },
            })
          : Promise.resolve(0),
        rule.max_per_month !== null
          ? this.prisma.reward_ledger_entries.count({
              where: {
                user_id: params.userId,
                rule_id: rule.id,
                entry_type: ledger_entry_type.CREDIT,
                created_at: { gte: startOfMonth },
              },
            })
          : Promise.resolve(0),
        rule.max_lifetime !== null
          ? this.prisma.reward_ledger_entries.count({
              where: {
                user_id: params.userId,
                rule_id: rule.id,
                entry_type: ledger_entry_type.CREDIT,
              },
            })
          : Promise.resolve(0),
      ]);

      if (rule.max_per_day !== null && dayCount >= rule.max_per_day) {
        this.logger.warn(`User ${params.userId} reached daily limit for ${params.activity}`);
        return null;
      }
      if (rule.max_per_month !== null && monthCount >= rule.max_per_month) {
        this.logger.warn(`User ${params.userId} reached monthly limit for ${params.activity}`);
        return null;
      }
      if (rule.max_lifetime !== null && lifetimeCount >= rule.max_lifetime) {
        this.logger.warn(`User ${params.userId} reached lifetime limit for ${params.activity}`);
        return null;
      }
    }

    // Idempotency check
    if (params.idempotencyKey) {
      const existingEntry = await this.prisma.reward_ledger_entries.findUnique({
        where: { idempotency_key: params.idempotencyKey },
      });
      if (existingEntry) {
        return {
          walletId: existingEntry.wallet_id,
          pointsCredited: existingEntry.points,
          balanceAfter: existingEntry.balance_after,
          idempotent: true,
        };
      }
    }

    const points = Math.max(1, Math.round(rule.points * Number(rule.multiplier)));
    const validityDays = 365;
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      // 1. Ensure wallet exists and acquire row lock
      let wallet = await tx.reward_wallets.findUnique({ where: { user_id: params.userId } });
      if (!wallet) {
        wallet = await tx.reward_wallets.create({
          data: {
            user_id: params.userId,
            total_earned: 0,
            current_balance: 0,
            lifetime_balance: 0,
            tier: 'BRONZE',
          },
        });
      }

      await tx.$queryRaw`SELECT id FROM reward_wallets WHERE id = ${wallet.id}::uuid FOR UPDATE`;

      const newBalance = wallet.current_balance + points;
      const newLifetime = wallet.lifetime_balance + points;
      const newTotalEarned = wallet.total_earned + points;
      const newTier = calculateTier(newLifetime);

      // 2. Update wallet
      const updatedWallet = await tx.reward_wallets.update({
        where: { id: wallet.id },
        data: {
          current_balance: newBalance,
          total_earned: newTotalEarned,
          lifetime_balance: newLifetime,
          tier: newTier,
          updated_at: new Date(),
        },
      });

      // 3. Create immutable ledger entry
      const ledgerEntry = await tx.reward_ledger_entries.create({
        data: {
          wallet_id: wallet.id,
          user_id: params.userId,
          entry_type: ledger_entry_type.CREDIT,
          activity: params.activity,
          rule_id: rule.id,
          points,
          remaining_points: points,
          balance_after: newBalance,
          reference_type: params.referenceType,
          reference_id: params.referenceId,
          description: `${rule.name} credited`,
          expires_at: expiresAt,
          idempotency_key: params.idempotencyKey,
          performed_by_id: params.performedById,
        },
      });

      // 4. Create transaction log
      await tx.reward_transactions.create({
        data: {
          wallet_id: wallet.id,
          user_id: params.userId,
          type: reward_transaction_type.EARNED,
          points,
          balance_after: newBalance,
          activity: params.activity,
          rule_id: rule.id,
          reference_type: params.referenceType,
          reference_id: params.referenceId,
          description: `${rule.name} reward credited`,
          expires_at: expiresAt,
          performed_by_id: params.performedById,
        },
      });

      return {
        walletId: updatedWallet.id,
        pointsCredited: points,
        balanceAfter: newBalance,
        ledgerEntryId: ledgerEntry.id,
      };
    });
  }

  /**
   * Deducts points from a user's wallet using FIFO against unexpired credit batches.
   * Must be called inside an ongoing transaction with an acquired wallet lock.
   */
  async deductPointsInsideTx(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      points: number;
      description: string;
      referenceType: string;
      referenceId: string;
      idempotencyKey?: string;
      performedById?: string;
    },
  ) {
    if (params.points <= 0) {
      throw new BadRequestException('Points to deduct must be greater than zero');
    }

    const wallet = await tx.reward_wallets.findUnique({
      where: { user_id: params.userId },
    });

    if (!wallet) {
      throw new BadRequestException('User does not have an active reward wallet');
    }

    // Row lock on wallet
    await tx.$queryRaw`SELECT id FROM reward_wallets WHERE id = ${wallet.id}::uuid FOR UPDATE`;

    if (wallet.current_balance < params.points) {
      throw new BadRequestException(
        `Insufficient points balance. Available: ${wallet.current_balance}, Required: ${params.points}`,
      );
    }

    // FIFO deduction against unexpired credit batches
    const now = new Date();
    const creditLots = await tx.reward_ledger_entries.findMany({
      where: {
        wallet_id: wallet.id,
        entry_type: ledger_entry_type.CREDIT,
        remaining_points: { gt: 0 },
        is_expired: false,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      orderBy: { created_at: 'asc' },
    });

    let pointsRemainingToDeduct = params.points;
    for (const lot of creditLots) {
      if (pointsRemainingToDeduct <= 0) break;
      const deductFromLot = Math.min(lot.remaining_points, pointsRemainingToDeduct);
      await tx.reward_ledger_entries.update({
        where: { id: lot.id },
        data: { remaining_points: lot.remaining_points - deductFromLot },
      });
      pointsRemainingToDeduct -= deductFromLot;
    }

    const newBalance = wallet.current_balance - params.points;
    const newTotalRedeemed = wallet.total_redeemed + params.points;

    // Update wallet balance
    await tx.reward_wallets.update({
      where: { id: wallet.id },
      data: {
        current_balance: newBalance,
        total_redeemed: newTotalRedeemed,
        updated_at: new Date(),
      },
    });

    // Create DEBIT ledger entry
    const debitEntry = await tx.reward_ledger_entries.create({
      data: {
        wallet_id: wallet.id,
        user_id: params.userId,
        entry_type: ledger_entry_type.DEBIT,
        points: params.points,
        remaining_points: 0,
        balance_after: newBalance,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        description: params.description,
        idempotency_key: params.idempotencyKey,
        performed_by_id: params.performedById,
      },
    });

    // Create reward_transactions record
    await tx.reward_transactions.create({
      data: {
        wallet_id: wallet.id,
        user_id: params.userId,
        type: reward_transaction_type.REDEEMED,
        points: params.points,
        balance_after: newBalance,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        description: params.description,
        performed_by_id: params.performedById,
      },
    });

    return {
      walletId: wallet.id,
      pointsDeducted: params.points,
      balanceAfter: newBalance,
      ledgerEntryId: debitEntry.id,
    };
  }

  /**
   * Refunds / restores points to a user's wallet inside a transaction.
   */
  async refundPointsInsideTx(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      points: number;
      description: string;
      referenceType: string;
      referenceId: string;
      performedById?: string;
    },
  ) {
    const wallet = await tx.reward_wallets.findUnique({
      where: { user_id: params.userId },
    });
    if (!wallet) {
      throw new NotFoundException('Reward wallet not found');
    }

    await tx.$queryRaw`SELECT id FROM reward_wallets WHERE id = ${wallet.id}::uuid FOR UPDATE`;

    const newBalance = wallet.current_balance + params.points;
    const newTotalRedeemed = Math.max(0, wallet.total_redeemed - params.points);

    await tx.reward_wallets.update({
      where: { id: wallet.id },
      data: {
        current_balance: newBalance,
        total_redeemed: newTotalRedeemed,
        updated_at: new Date(),
      },
    });

    await tx.reward_ledger_entries.create({
      data: {
        wallet_id: wallet.id,
        user_id: params.userId,
        entry_type: ledger_entry_type.CREDIT,
        points: params.points,
        remaining_points: params.points,
        balance_after: newBalance,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        description: params.description,
        performed_by_id: params.performedById,
      },
    });

    await tx.reward_transactions.create({
      data: {
        wallet_id: wallet.id,
        user_id: params.userId,
        type: reward_transaction_type.REVERSED,
        points: params.points,
        balance_after: newBalance,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        description: params.description,
        performed_by_id: params.performedById,
      },
    });

    return { balanceAfter: newBalance };
  }

  /**
   * Manual points adjustment by admin (bonus or administrative deduction).
   */
  async adminAdjustPoints(dto: ManualPointsAdjustmentDto, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      let wallet = await tx.reward_wallets.findUnique({ where: { user_id: dto.userId } });
      if (!wallet) {
        wallet = await tx.reward_wallets.create({
          data: {
            user_id: dto.userId,
            total_earned: 0,
            current_balance: 0,
            lifetime_balance: 0,
            tier: 'BRONZE',
          },
        });
      }

      await tx.$queryRaw`SELECT id FROM reward_wallets WHERE id = ${wallet.id}::uuid FOR UPDATE`;

      if (dto.direction === 'DEBIT' && wallet.current_balance < dto.points) {
        throw new BadRequestException(
          `Cannot deduct ${dto.points} points. User only has ${wallet.current_balance} points.`,
        );
      }

      const pointDelta = dto.direction === 'CREDIT' ? dto.points : -dto.points;
      const newBalance = wallet.current_balance + pointDelta;
      const newLifetime = dto.direction === 'CREDIT'
        ? wallet.lifetime_balance + dto.points
        : wallet.lifetime_balance;
      const newTier = calculateTier(newLifetime);

      await tx.reward_wallets.update({
        where: { id: wallet.id },
        data: {
          current_balance: newBalance,
          lifetime_balance: newLifetime,
          total_earned: dto.direction === 'CREDIT' ? wallet.total_earned + dto.points : wallet.total_earned,
          total_redeemed: dto.direction === 'DEBIT' ? wallet.total_redeemed + dto.points : wallet.total_redeemed,
          tier: newTier,
          updated_at: new Date(),
        },
      });

      const entryType = dto.direction === 'CREDIT' ? ledger_entry_type.CREDIT : ledger_entry_type.DEBIT;

      const ledger = await tx.reward_ledger_entries.create({
        data: {
          wallet_id: wallet.id,
          user_id: dto.userId,
          entry_type: entryType,
          points: dto.points,
          remaining_points: dto.direction === 'CREDIT' ? dto.points : 0,
          balance_after: newBalance,
          reference_type: 'admin_adjustment',
          description: dto.reason,
          performed_by_id: adminId,
        },
      });

      await tx.reward_transactions.create({
        data: {
          wallet_id: wallet.id,
          user_id: dto.userId,
          type: dto.type,
          points: dto.points,
          balance_after: newBalance,
          reference_type: 'admin_adjustment',
          reference_id: ledger.id,
          description: dto.reason,
          performed_by_id: adminId,
        },
      });

      return {
        walletId: wallet.id,
        adjustedPoints: pointDelta,
        balanceAfter: newBalance,
        tier: newTier,
      };
    });
  }

  /**
   * Returns current user's wallet information and recent ledger activity.
   */
  async getMyRewards(userId: string) {
    const wallet = await this.prisma.reward_wallets.findUnique({
      where: { user_id: userId },
    });

    const [ledgerEntries, expiringSoonLots] = await Promise.all([
      this.prisma.reward_ledger_entries.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      this.prisma.reward_ledger_entries.findMany({
        where: {
          user_id: userId,
          entry_type: ledger_entry_type.CREDIT,
          remaining_points: { gt: 0 },
          is_expired: false,
          expires_at: {
            gt: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // next 30 days
          },
        },
        select: { remaining_points: true, expires_at: true },
      }),
    ]);

    const expiringPoints = expiringSoonLots.reduce((acc, curr) => acc + curr.remaining_points, 0);

    return {
      wallet: wallet
        ? {
            currentBalance: wallet.current_balance,
            totalEarned: wallet.total_earned,
            totalRedeemed: wallet.total_redeemed,
            totalExpired: wallet.total_expired,
            tier: wallet.tier,
            expiringIn30Days: expiringPoints,
          }
        : {
            currentBalance: 0,
            totalEarned: 0,
            totalRedeemed: 0,
            totalExpired: 0,
            tier: 'BRONZE',
            expiringIn30Days: 0,
          },
      history: ledgerEntries.map((entry) => ({
        id: entry.id,
        type: entry.entry_type,
        points: entry.points,
        balanceAfter: entry.balance_after,
        activity: entry.activity,
        description: entry.description,
        createdAt: entry.created_at,
        expiresAt: entry.expires_at,
      })),
    };
  }

  async listLedger(query: ListLedgerEntriesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.reward_ledger_entriesWhereInput = {
      ...(query.userId ? { user_id: query.userId } : {}),
      ...(query.entryType ? { entry_type: query.entryType } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.reward_ledger_entries.count({ where }),
      this.prisma.reward_ledger_entries.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      items: rows,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async listWallets(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, rows] = await Promise.all([
      this.prisma.reward_wallets.count(),
      this.prisma.reward_wallets.findMany({
        skip,
        take: limit,
        orderBy: { current_balance: 'desc' },
      }),
    ]);

    const userIds = rows.map((r) => r.user_id);
    const users = await this.prisma.users.findMany({
      where: { id: { in: userIds } },
      select: { id: true, full_name: true, email: true, mobile: true },
    });
    const usersById = new Map(users.map((u) => [u.id, u]));

    return {
      items: rows.map((r) => ({
        ...r,
        user: usersById.get(r.user_id) ?? null,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}
