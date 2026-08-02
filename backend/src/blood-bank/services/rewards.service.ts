import { Injectable } from '@nestjs/common';
import { reward_activity, reward_transaction_type } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Credits a user's reward wallet per the active reward_rules row for the activity, if one exists. */
  async creditForActivity(params: {
    userId: string;
    activity: reward_activity;
    referenceType: string;
    referenceId: string;
    performedById?: string;
  }) {
    const rule = await this.prisma.reward_rules.findUnique({ where: { activity: params.activity } });
    if (!rule || !rule.is_active) {
      return null;
    }

    const points = Math.round(rule.points * Number(rule.multiplier));

    const wallet = await this.prisma.reward_wallets.upsert({
      where: { user_id: params.userId },
      create: {
        user_id: params.userId,
        total_earned: points,
        current_balance: points,
        lifetime_balance: points,
      },
      update: {
        total_earned: { increment: points },
        current_balance: { increment: points },
        lifetime_balance: { increment: points },
        updated_at: new Date(),
      },
    });

    await this.prisma.reward_transactions.create({
      data: {
        wallet_id: wallet.id,
        user_id: params.userId,
        type: reward_transaction_type.EARNED,
        points,
        balance_after: wallet.current_balance,
        activity: params.activity,
        rule_id: rule.id,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        description: `${rule.name} reward credited`,
        performed_by_id: params.performedById,
      },
    });

    return { walletId: wallet.id, pointsCredited: points, balanceAfter: wallet.current_balance };
  }
}
