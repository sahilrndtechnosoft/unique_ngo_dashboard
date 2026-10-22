import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  Prisma,
  redemption_status,
  voucher_status,
} from '../../../generated/prisma/client';
import { PartnerAdapterFactory } from '../../partners/adapters/partner-adapter.factory';
import { PrismaService } from '../../prisma/prisma.service';
import { RewardsCatalogService } from '../../rewards-catalog/services/rewards-catalog.service';
import { RewardsService } from '../../rewards/services/rewards.service';
import { VouchersService } from '../../vouchers/services/vouchers.service';
import {
  AdminRefundRedemptionDto,
  ListRedemptionsQueryDto,
  RedeemCatalogItemDto,
} from '../dto/redemption.dto';

const TIER_ORDER: Record<string, number> = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
  PLATINUM: 4,
};

@Injectable()
export class RedemptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardsService: RewardsService,
    private readonly catalogService: RewardsCatalogService,
    private readonly vouchersService: VouchersService,
    private readonly partnerAdapterFactory: PartnerAdapterFactory,
  ) {}

  /**
   * Executes atomic two-phase redemption of points for a catalog item/voucher.
   * Phase 1: DB Transaction (Row locks on wallet & catalog item, FIFO points deduction, voucher issuance).
   * Phase 2: External Partner Call (outside DB locks).
   * Compensating Action: Automatic rollback & point refund if partner fails.
   */
  async redeemCatalogItem(userId: string, dto: RedeemCatalogItemDto) {
    // 1. Idempotency Check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.reward_redemptions.findUnique({
        where: { idempotency_key: dto.idempotencyKey },
      });
      if (existing) {
        if (existing.status === redemption_status.COMPLETED) {
          const voucher = existing.voucher_id
            ? await this.prisma.vouchers.findUnique({ where: { id: existing.voucher_id } })
            : null;
          const wallet = await this.prisma.reward_wallets.findUnique({
            where: { user_id: userId },
          });
          return {
            redemptionId: existing.id,
            status: existing.status,
            voucher: voucher ? this.formatVoucher(voucher) : null,
            pointsUsed: existing.points_used,
            currentBalance: wallet?.current_balance ?? 0,
            isIdempotentReplay: true,
          };
        }
      }
    }

    // 2. Pre-check Wallet & Catalog Item
    const [wallet, item] = await Promise.all([
      this.prisma.reward_wallets.findUnique({ where: { user_id: userId } }),
      this.prisma.rewards_catalog_items.findUnique({ where: { id: dto.catalogItemId } }),
    ]);

    if (!wallet) {
      throw new BadRequestException('You do not have an active rewards wallet');
    }
    if (!item) {
      throw new NotFoundException('Reward catalog item not found');
    }
    if (!item.is_active) {
      throw new BadRequestException('This reward item is no longer available');
    }

    const now = new Date();
    if (item.starts_at && item.starts_at > now) {
      throw new BadRequestException('This reward is not yet available');
    }
    if (item.expires_at && item.expires_at < now) {
      throw new BadRequestException('This reward item has expired');
    }

    // Check user tier eligibility
    const userTierLevel = TIER_ORDER[wallet.tier] ?? 1;
    const itemTierLevel = TIER_ORDER[item.min_user_tier] ?? 1;
    if (userTierLevel < itemTierLevel) {
      throw new BadRequestException(
        `This reward requires ${item.min_user_tier} tier. Your current tier is ${wallet.tier}.`,
      );
    }

    if (wallet.current_balance < item.points_cost) {
      throw new BadRequestException(
        `Insufficient points balance. You have ${wallet.current_balance} points, but need ${item.points_cost} points.`,
      );
    }

    const redemptionId = crypto.randomUUID();

    // 3. Phase 1: DB Transaction
    const phase1Result = await this.prisma.$transaction(async (tx) => {
      // Reserve stock with lock
      await this.catalogService.reserveStockInsideTx(tx, item.id);

      // Deduct points FIFO
      const deduction = await this.rewardsService.deductPointsInsideTx(tx, {
        userId,
        points: item.points_cost,
        description: `Redeemed for ${item.title}`,
        referenceType: 'REDEMPTION',
        referenceId: redemptionId,
        idempotencyKey: dto.idempotencyKey ? `${dto.idempotencyKey}-debit` : undefined,
      });

      // Issue voucher
      const voucher = await this.vouchersService.issueVoucherInsideTx(tx, {
        userId,
        catalogItemId: item.id,
        partnerStoreId: item.partner_store_id ?? undefined,
        title: item.title,
        description: item.description ?? undefined,
        pointsSpent: item.points_cost,
        monetaryValue: Number(item.monetary_value),
        validityDays: item.validity_days,
        idempotencyKey: dto.idempotencyKey ? `${dto.idempotencyKey}-vch` : undefined,
      });

      // Create redemption record in PROCESSING status
      const redemption = await tx.reward_redemptions.create({
        data: {
          id: redemptionId,
          user_id: userId,
          wallet_id: wallet.id,
          voucher_id: voucher.id,
          catalog_item_id: item.id,
          partner_store_id: item.partner_store_id,
          points_used: item.points_cost,
          monetary_value: item.monetary_value,
          status: redemption_status.PROCESSING,
          idempotency_key: dto.idempotencyKey,
        },
      });

      return { redemption, voucher, newBalance: deduction.balanceAfter };
    });

    const { redemption, voucher, newBalance } = phase1Result;

    // 4. Phase 2: Partner Adapter Call (outside locks)
    if (item.partner_store_id) {
      const partner = await this.prisma.partner_stores.findUnique({
        where: { id: item.partner_store_id },
      });

      if (partner && partner.adapter_type) {
        try {
          const user = await this.prisma.users.findUnique({
            where: { id: userId },
            select: { email: true, mobile: true },
          });

          const adapter = this.partnerAdapterFactory.getAdapter(partner.adapter_type);
          const partnerResult = await adapter.issueVoucher({
            partnerStoreId: partner.id,
            partnerStoreSlug: partner.slug,
            voucherCode: voucher.code,
            securityPin: voucher.security_pin ?? undefined,
            monetaryValue: Number(item.monetary_value),
            userId,
            userEmail: user?.email,
            userPhone: user?.mobile,
            catalogItemId: item.id,
            catalogItemTitle: item.title,
            expiresAt: voucher.expires_at,
            config: (partner.config as Record<string, unknown>) ?? null,
          });

          if (!partnerResult.success) {
            throw new Error(
              partnerResult.error || 'Partner store rejected voucher creation',
            );
          }

          if (partnerResult.partnerReference) {
            await this.prisma.vouchers.update({
              where: { id: voucher.id },
              data: {
                partner_reference: partnerResult.partnerReference,
                updated_at: new Date(),
              },
            });
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Partner service failed';

          // COMPENSATING ROLLBACK: Restore stock, refund points, cancel voucher, mark failed
          await this.prisma.$transaction(async (rollbackTx) => {
            await this.catalogService.restoreStockInsideTx(rollbackTx, item.id);
            await this.rewardsService.refundPointsInsideTx(rollbackTx, {
              userId,
              points: item.points_cost,
              description: `Refund: partner issue failed for ${item.title}`,
              referenceType: 'REDEMPTION',
              referenceId: redemptionId,
            });
            await rollbackTx.vouchers.update({
              where: { id: voucher.id },
              data: { status: voucher_status.CANCELLED, updated_at: new Date() },
            });
            await rollbackTx.reward_redemptions.update({
              where: { id: redemptionId },
              data: {
                status: redemption_status.FAILED,
                failure_reason: errorMessage,
                updated_at: new Date(),
              },
            });
            await rollbackTx.redemption_audit_logs.create({
              data: {
                event_type: 'REDEMPTION_COMPENSATED_REFUND',
                actor_type: 'SYSTEM',
                actor_id: userId,
                entity_type: 'REDEMPTION',
                entity_id: redemptionId,
                metadata: {
                  reason: errorMessage,
                  pointsRefunded: item.points_cost,
                },
              },
            });
          });

          throw new BadRequestException(
            `Unable to issue partner voucher: ${errorMessage}. Your points have been refunded in full.`,
          );
        }
      }
    }

    // 5. Finalize status to COMPLETED
    await this.prisma.reward_redemptions.update({
      where: { id: redemptionId },
      data: { status: redemption_status.COMPLETED, updated_at: new Date() },
    });

    await this.prisma.redemption_audit_logs.create({
      data: {
        event_type: 'REDEMPTION_COMPLETED',
        actor_type: 'USER',
        actor_id: userId,
        entity_type: 'REDEMPTION',
        entity_id: redemptionId,
        metadata: {
          pointsUsed: item.points_cost,
          voucherCode: voucher.code,
        },
      },
    });

    // Fetch latest voucher state
    const finalVoucher = await this.prisma.vouchers.findUnique({
      where: { id: voucher.id },
    });

    return {
      redemptionId,
      status: redemption_status.COMPLETED,
      voucher: finalVoucher ? this.formatVoucher(finalVoucher) : null,
      pointsUsed: item.points_cost,
      remainingBalance: newBalance,
      isIdempotentReplay: false,
    };
  }

  /**
   * List redemptions for authenticated user.
   */
  async listMyRedemptions(userId: string, query: ListRedemptionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.reward_redemptionsWhereInput = {
      user_id: userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.catalogItemId ? { catalog_item_id: query.catalogItemId } : {}),
      ...(query.partnerStoreId ? { partner_store_id: query.partnerStoreId } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.reward_redemptions.count({ where }),
      this.prisma.reward_redemptions.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    // Hydrate catalog items & vouchers
    const voucherIds = rows
      .map((r) => r.voucher_id)
      .filter((id): id is string => Boolean(id));
    const catalogItemIds = rows
      .map((r) => r.catalog_item_id)
      .filter((id): id is string => Boolean(id));

    const [vouchers, catalogItems] = await Promise.all([
      voucherIds.length
        ? this.prisma.vouchers.findMany({ where: { id: { in: voucherIds } } })
        : [],
      catalogItemIds.length
        ? this.prisma.rewards_catalog_items.findMany({ where: { id: { in: catalogItemIds } } })
        : [],
    ]);

    const vouchersMap = new Map(vouchers.map((v) => [v.id, this.formatVoucher(v)]));
    const catalogMap = new Map(
      catalogItems.map((c) => [
        c.id,
        { id: c.id, title: c.title, imageUrl: c.image_url, category: c.category },
      ]),
    );

    const items = rows.map((r) => ({
      id: r.id,
      pointsUsed: r.points_used,
      monetaryValue: Number(r.monetary_value),
      status: r.status,
      failureReason: r.failure_reason,
      createdAt: r.created_at,
      voucher: r.voucher_id ? vouchersMap.get(r.voucher_id) ?? null : null,
      catalogItem: r.catalog_item_id ? catalogMap.get(r.catalog_item_id) ?? null : null,
    }));

    return {
      items,
      redemptions: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Admin list redemptions with user and audit context.
   */
  async adminListRedemptions(query: ListRedemptionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.reward_redemptionsWhereInput = {
      ...(query.userId ? { user_id: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.catalogItemId ? { catalog_item_id: query.catalogItemId } : {}),
      ...(query.partnerStoreId ? { partner_store_id: query.partnerStoreId } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.reward_redemptions.count({ where }),
      this.prisma.reward_redemptions.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const voucherIds = rows
      .map((r) => r.voucher_id)
      .filter((id): id is string => Boolean(id));
    const catalogItemIds = rows
      .map((r) => r.catalog_item_id)
      .filter((id): id is string => Boolean(id));
    const partnerStoreIds = rows
      .map((r) => r.partner_store_id)
      .filter((id): id is string => Boolean(id));

    const [users, vouchers, catalogItems, partners] = await Promise.all([
      userIds.length
        ? this.prisma.users.findMany({
            where: { id: { in: userIds } },
            select: { id: true, full_name: true, email: true, mobile: true },
          })
        : [],
      voucherIds.length
        ? this.prisma.vouchers.findMany({ where: { id: { in: voucherIds } } })
        : [],
      catalogItemIds.length
        ? this.prisma.rewards_catalog_items.findMany({
            where: { id: { in: catalogItemIds } },
            select: { id: true, title: true, image_url: true, category: true, item_type: true },
          })
        : [],
      partnerStoreIds.length
        ? this.prisma.partner_stores.findMany({
            where: { id: { in: partnerStoreIds } },
            select: { id: true, name: true, slug: true, logo_url: true, category: true },
          })
        : [],
    ]);

    const usersMap = new Map(
      users.map((u) => [
        u.id,
        { id: u.id, name: u.full_name, email: u.email, mobile: u.mobile },
      ]),
    );
    const vouchersMap = new Map(vouchers.map((v) => [v.id, this.formatVoucher(v)]));
    const catalogMap = new Map(
      catalogItems.map((c) => [
        c.id,
        { id: c.id, title: c.title, imageUrl: c.image_url, category: c.category, itemType: c.item_type },
      ]),
    );
    const partnersMap = new Map(
      partners.map((p) => [
        p.id,
        { id: p.id, name: p.name, slug: p.slug, logoUrl: p.logo_url, category: p.category },
      ]),
    );

    const items = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      user: usersMap.get(r.user_id) ?? null,
      catalogItemId: r.catalog_item_id,
      catalogItem: r.catalog_item_id ? catalogMap.get(r.catalog_item_id) ?? null : null,
      partnerStoreId: r.partner_store_id,
      partnerStore: r.partner_store_id ? partnersMap.get(r.partner_store_id) ?? null : null,
      pointsUsed: r.points_used,
      monetaryValue: Number(r.monetary_value),
      status: r.status,
      failureReason: r.failure_reason,
      idempotencyKey: r.idempotency_key,
      createdAt: r.created_at,
      voucher: r.voucher_id ? vouchersMap.get(r.voucher_id) ?? null : null,
    }));

    return {
      items,
      redemptions: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Admin get single redemption detail by ID with complete user, voucher, and audit history.
   */
  async adminGetRedemptionById(redemptionId: string) {
    const redemption = await this.prisma.reward_redemptions.findUnique({
      where: { id: redemptionId },
    });
    if (!redemption) {
      throw new NotFoundException('Redemption record not found');
    }

    const [user, voucher, catalogItem, partnerStore, auditLogs] = await Promise.all([
      this.prisma.users.findUnique({
        where: { id: redemption.user_id },
        select: { id: true, full_name: true, email: true, mobile: true, status: true, created_at: true },
      }),
      redemption.voucher_id
        ? this.prisma.vouchers.findUnique({ where: { id: redemption.voucher_id } })
        : null,
      redemption.catalog_item_id
        ? this.prisma.rewards_catalog_items.findUnique({ where: { id: redemption.catalog_item_id } })
        : null,
      redemption.partner_store_id
        ? this.prisma.partner_stores.findUnique({ where: { id: redemption.partner_store_id } })
        : null,
      this.prisma.redemption_audit_logs.findMany({
        where: {
          OR: [
            { entity_id: redemption.id },
            ...(redemption.voucher_id ? [{ entity_id: redemption.voucher_id }] : []),
          ],
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      id: redemption.id,
      userId: redemption.user_id,
      user: user
        ? { id: user.id, name: user.full_name, email: user.email, mobile: user.mobile, status: user.status }
        : null,
      pointsUsed: redemption.points_used,
      monetaryValue: Number(redemption.monetary_value),
      status: redemption.status,
      failureReason: redemption.failure_reason,
      idempotencyKey: redemption.idempotency_key,
      createdAt: redemption.created_at,
      updatedAt: redemption.updated_at,
      voucher: voucher ? this.formatVoucher(voucher) : null,
      catalogItem: catalogItem
        ? {
            id: catalogItem.id,
            title: catalogItem.title,
            description: catalogItem.description,
            imageUrl: catalogItem.image_url,
            category: catalogItem.category,
            itemType: catalogItem.item_type,
            pointsCost: catalogItem.points_cost,
            monetaryValue: Number(catalogItem.monetary_value),
            minUserTier: catalogItem.min_user_tier,
            validityDays: catalogItem.validity_days,
          }
        : null,
      partnerStore: partnerStore
        ? {
            id: partnerStore.id,
            name: partnerStore.name,
            slug: partnerStore.slug,
            logoUrl: partnerStore.logo_url,
            category: partnerStore.category,
            websiteUrl: partnerStore.website_url,
            adapterType: partnerStore.adapter_type,
          }
        : null,
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        eventType: log.event_type,
        actorType: log.actor_type,
        actorId: log.actor_id,
        entityType: log.entity_type,
        entityId: log.entity_id,
        metadata: log.metadata,
        createdAt: log.created_at,
      })),
    };
  }

  /**
   * Admin manual refund & reversal of points.
   */
  async adminRefundRedemption(redemptionId: string, dto: AdminRefundRedemptionDto, adminUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const redemption = await tx.reward_redemptions.findUnique({
        where: { id: redemptionId },
      });
      if (!redemption) {
        throw new NotFoundException('Redemption record not found');
      }

      await tx.$queryRaw`SELECT id FROM reward_redemptions WHERE id = ${redemption.id}::uuid FOR UPDATE`;

      if (redemption.status === redemption_status.REFUNDED) {
        throw new BadRequestException('This redemption has already been refunded');
      }
      if (redemption.status !== redemption_status.COMPLETED) {
        throw new BadRequestException(
          `Cannot refund redemption with status ${redemption.status}`,
        );
      }

      // Check voucher status: cannot refund if already redeemed by user at store
      if (redemption.voucher_id) {
        const voucher = await tx.vouchers.findUnique({
          where: { id: redemption.voucher_id },
        });
        if (voucher) {
          if (voucher.status === voucher_status.REDEEMED) {
            throw new BadRequestException(
              'Cannot refund: voucher has already been redeemed by customer at the store',
            );
          }
          await tx.vouchers.update({
            where: { id: voucher.id },
            data: { status: voucher_status.CANCELLED, updated_at: new Date() },
          });
        }
      }

      // Restore stock
      if (redemption.catalog_item_id) {
        await this.catalogService.restoreStockInsideTx(tx, redemption.catalog_item_id);
      }

      // Refund points back to user wallet
      await this.rewardsService.refundPointsInsideTx(tx, {
        userId: redemption.user_id,
        points: redemption.points_used,
        description: `Admin refund: ${dto.reason}`,
        referenceType: 'REDEMPTION',
        referenceId: redemption.id,
        performedById: adminUserId,
      });

      // Update redemption record
      const updated = await tx.reward_redemptions.update({
        where: { id: redemptionId },
        data: {
          status: redemption_status.REFUNDED,
          failure_reason: `Admin refund: ${dto.reason}`,
          updated_at: new Date(),
        },
      });

      await tx.redemption_audit_logs.create({
        data: {
          event_type: 'ADMIN_REDEMPTION_REFUNDED',
          actor_type: 'ADMIN',
          actor_id: adminUserId,
          entity_type: 'REDEMPTION',
          entity_id: redemptionId,
          metadata: {
            reason: dto.reason,
            pointsRefunded: redemption.points_used,
          },
        },
      });

      return {
        id: updated.id,
        status: updated.status,
        pointsRefunded: redemption.points_used,
        reason: dto.reason,
      };
    });
  }

  private formatVoucher(v: any) {
    return {
      id: v.id,
      code: v.code,
      title: v.title,
      monetaryValue: Number(v.monetary_value),
      status: v.status,
      securityPin: v.security_pin,
      qrPayload: v.qr_payload,
      partnerReference: v.partner_reference,
      expiresAt: v.expires_at,
      redeemedAt: v.redeemed_at,
    };
  }
}
