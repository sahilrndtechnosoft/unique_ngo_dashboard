import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, rewards_catalog_items } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCatalogItemDto,
  ListCatalogItemsQueryDto,
  UpdateCatalogItemDto,
} from '../dto/catalog.dto';

const TIER_ORDER: Record<string, number> = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
  PLATINUM: 4,
};

@Injectable()
export class RewardsCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async createItem(dto: CreateCatalogItemDto) {
    if (dto.partnerStoreId) {
      const partner = await this.prisma.partner_stores.findUnique({
        where: { id: dto.partnerStoreId },
      });
      if (!partner) {
        throw new NotFoundException(`Partner store not found`);
      }
    }

    if (dto.startsAt && dto.expiresAt && new Date(dto.startsAt) > new Date(dto.expiresAt)) {
      throw new BadRequestException('startsAt date cannot be after expiresAt');
    }

    const item = await this.prisma.rewards_catalog_items.create({
      data: {
        partner_store_id: dto.partnerStoreId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        image_url: dto.imageUrl?.trim(),
        category: dto.category ?? 'VOUCHER',
        points_cost: dto.pointsCost,
        monetary_value: dto.monetaryValue,
        item_type: dto.itemType,
        stock: dto.stock,
        validity_days: dto.validityDays ?? 30,
        min_user_tier: (dto.minUserTier ?? 'BRONZE').toUpperCase(),
        terms_and_conditions: dto.termsAndConditions?.trim(),
        is_active: dto.isActive ?? true,
        starts_at: dto.startsAt ? new Date(dto.startsAt) : null,
        expires_at: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return this.toPublic(item);
  }

  async listItems(query: ListCatalogItemsQueryDto, userTier?: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.rewards_catalog_itemsWhereInput = {
      ...(query.isActive !== undefined ? { is_active: query.isActive } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.itemType ? { item_type: query.itemType } : {}),
      ...(query.partnerStoreId ? { partner_store_id: query.partnerStoreId } : {}),
      ...(query.maxPoints !== undefined ? { points_cost: { lte: query.maxPoints } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.rewards_catalog_items.count({ where }),
      this.prisma.rewards_catalog_items.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ points_cost: 'asc' }, { created_at: 'desc' }],
      }),
    ]);

    // Attach partner stores
    const partnerIds = rows.map((r) => r.partner_store_id).filter((id): id is string => Boolean(id));
    const partners = partnerIds.length
      ? await this.prisma.partner_stores.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, name: true, slug: true, logo_url: true, category: true },
        })
      : [];
    const partnersById = new Map(partners.map((p) => [p.id, p]));

    const userTierLevel = userTier ? TIER_ORDER[userTier.toUpperCase()] ?? 1 : 1;

    const items = rows.map((r) => {
      const itemTierLevel = TIER_ORDER[r.min_user_tier] ?? 1;
      const isEligible = userTierLevel >= itemTierLevel;
      return {
        ...this.toPublic(r),
        partnerStore: r.partner_store_id ? partnersById.get(r.partner_store_id) ?? null : null,
        isEligibleForUser: isEligible,
      };
    });

    return {
      items,
      catalogItems: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getItemById(id: string) {
    const item = await this.findOrThrow(id);
    const partner = item.partner_store_id
      ? await this.prisma.partner_stores.findUnique({ where: { id: item.partner_store_id } })
      : null;

    return {
      ...this.toPublic(item),
      partnerStore: partner,
    };
  }

  async updateItem(id: string, dto: UpdateCatalogItemDto) {
    await this.findOrThrow(id);

    if (dto.partnerStoreId) {
      const partner = await this.prisma.partner_stores.findUnique({
        where: { id: dto.partnerStoreId },
      });
      if (!partner) throw new NotFoundException(`Partner store not found`);
    }

    const updated = await this.prisma.rewards_catalog_items.update({
      where: { id },
      data: {
        ...(dto.partnerStoreId !== undefined && { partner_store_id: dto.partnerStoreId }),
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() }),
        ...(dto.imageUrl !== undefined && { image_url: dto.imageUrl?.trim() }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.pointsCost !== undefined && { points_cost: dto.pointsCost }),
        ...(dto.monetaryValue !== undefined && { monetary_value: dto.monetaryValue }),
        ...(dto.itemType !== undefined && { item_type: dto.itemType }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.validityDays !== undefined && { validity_days: dto.validityDays }),
        ...(dto.minUserTier !== undefined && { min_user_tier: dto.minUserTier.toUpperCase() }),
        ...(dto.termsAndConditions !== undefined && { terms_and_conditions: dto.termsAndConditions?.trim() }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        ...(dto.startsAt !== undefined && { starts_at: dto.startsAt ? new Date(dto.startsAt) : null }),
        ...(dto.expiresAt !== undefined && { expires_at: dto.expiresAt ? new Date(dto.expiresAt) : null }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async deleteItem(id: string) {
    await this.findOrThrow(id);

    const issuedVouchers = await this.prisma.vouchers.count({
      where: { catalog_item_id: id },
    });
    if (issuedVouchers > 0) {
      throw new BadRequestException(
        'Cannot delete catalog item that has issued vouchers. Please deactivate it instead.',
      );
    }

    await this.prisma.rewards_catalog_items.delete({ where: { id } });
  }

  /**
   * Reserves / decrements stock for a catalog item inside an ongoing transaction with a row lock.
   */
  async reserveStockInsideTx(tx: Prisma.TransactionClient, itemId: string): Promise<rewards_catalog_items> {
    const item = await tx.rewards_catalog_items.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Catalog item not found');
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

    // Row lock on catalog item
    await tx.$queryRaw`SELECT id FROM rewards_catalog_items WHERE id = ${item.id}::uuid FOR UPDATE`;

    if (item.stock !== null) {
      if (item.stock <= 0) {
        throw new BadRequestException('This reward item is currently out of stock');
      }
      return tx.rewards_catalog_items.update({
        where: { id: item.id },
        data: { stock: item.stock - 1, updated_at: new Date() },
      });
    }

    return item;
  }

  /**
   * Restores stock if redemption failed or was refunded.
   */
  async restoreStockInsideTx(tx: Prisma.TransactionClient, itemId: string) {
    const item = await tx.rewards_catalog_items.findUnique({ where: { id: itemId } });
    if (item && item.stock !== null) {
      await tx.rewards_catalog_items.update({
        where: { id: itemId },
        data: { stock: item.stock + 1, updated_at: new Date() },
      });
    }
  }

  private async findOrThrow(id: string): Promise<rewards_catalog_items> {
    const item = await this.prisma.rewards_catalog_items.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Reward catalog item not found');
    }
    return item;
  }

  private toPublic(item: rewards_catalog_items) {
    return {
      id: item.id,
      partnerStoreId: item.partner_store_id,
      title: item.title,
      description: item.description,
      imageUrl: item.image_url,
      category: item.category,
      pointsCost: item.points_cost,
      monetaryValue: Number(item.monetary_value),
      itemType: item.item_type,
      stock: item.stock,
      validityDays: item.validity_days,
      minUserTier: item.min_user_tier,
      termsAndConditions: item.terms_and_conditions,
      isActive: item.is_active,
      startsAt: item.starts_at,
      expiresAt: item.expires_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }
}
