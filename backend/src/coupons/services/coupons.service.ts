import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { coupons, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { calculateProductCouponDiscount, productCouponEligibilityError } from '../coupon-validation';
import { CreateCouponDto, ListCouponsQueryDto, UpdateCouponDto } from '../dto/coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async adminCreate(dto: CreateCouponDto, createdById: string) {
    const code = dto.code.trim().toUpperCase();
    this.ensureCouponConfig(dto);
    const existing = await this.prisma.coupons.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('A coupon with this code already exists');
    }

    const coupon = await this.prisma.coupons.create({
      data: {
        code,
        description: dto.description,
        discount_type: dto.discountType ?? 'PERCENTAGE',
        discount_value: dto.discountValue,
        min_order_value: dto.minOrderValue ?? 0,
        max_discount: dto.maxDiscount,
        usage_limit: dto.usageLimit,
        per_user_limit: dto.perUserLimit ?? 1,
        applicable_to: dto.applicableTo ?? 'ALL',
        starts_at: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expires_at: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        created_by_id: createdById,
      },
    });

    return this.toPublic(coupon);
  }

  async adminList(query: ListCouponsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.couponsWhereInput = {
      ...(query.isActive !== undefined ? { is_active: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.coupons.count({ where }),
      this.prisma.coupons.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
    ]);

    return {
      items: rows.map((row) => this.toPublic(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async adminGet(id: string) {
    return this.toPublic(await this.findOrThrow(id));
  }

  async adminUpdate(id: string, dto: UpdateCouponDto) {
    const existing = await this.findOrThrow(id);
    this.ensureCouponConfig({
      discountType: dto.discountType ?? existing.discount_type,
      discountValue: dto.discountValue ?? Number(existing.discount_value),
      minOrderValue: dto.minOrderValue ?? Number(existing.min_order_value),
      maxDiscount: dto.maxDiscount !== undefined
        ? dto.maxDiscount
        : existing.max_discount === null ? undefined : Number(existing.max_discount),
      usageLimit: dto.usageLimit !== undefined ? dto.usageLimit : existing.usage_limit ?? undefined,
      perUserLimit: dto.perUserLimit ?? existing.per_user_limit,
      startsAt: dto.startsAt ?? existing.starts_at.toISOString(),
      expiresAt: dto.expiresAt ?? existing.expires_at?.toISOString(),
    });

    const updated = await this.prisma.coupons.update({
      where: { id },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.discountType !== undefined && { discount_type: dto.discountType }),
        ...(dto.discountValue !== undefined && { discount_value: dto.discountValue }),
        ...(dto.minOrderValue !== undefined && { min_order_value: dto.minOrderValue }),
        ...(dto.maxDiscount !== undefined && { max_discount: dto.maxDiscount }),
        ...(dto.usageLimit !== undefined && { usage_limit: dto.usageLimit }),
        ...(dto.perUserLimit !== undefined && { per_user_limit: dto.perUserLimit }),
        ...(dto.applicableTo !== undefined && { applicable_to: dto.applicableTo }),
        ...(dto.startsAt !== undefined && { starts_at: new Date(dto.startsAt) }),
        ...(dto.expiresAt !== undefined && { expires_at: new Date(dto.expiresAt) }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async adminDelete(id: string) {
    await this.findOrThrow(id);
    await this.prisma.coupons.update({
      where: { id },
      data: { is_active: false, updated_at: new Date() },
    });
  }

  async adminListUsages(id: string) {
    await this.findOrThrow(id);
    const usages = await this.prisma.coupon_usages.findMany({
      where: { coupon_id: id },
      orderBy: { used_at: 'desc' },
    });

    const usersById = await this.getUsersById(usages.map((usage) => usage.user_id));

    return usages.map((usage) => ({
      id: usage.id,
      user: usersById.get(usage.user_id)
        ? { id: usage.user_id, fullName: usersById.get(usage.user_id)?.full_name, email: usersById.get(usage.user_id)?.email }
        : null,
      orderId: usage.order_id,
      discount: Number(usage.discount),
      usedAt: usage.used_at,
    }));
  }

  /** Coupons an authenticated user can currently use — active, within its date window, and not exhausted by them. */
  async listAvailableForUser(userId: string) {
    const now = new Date();
    const coupons = await this.prisma.coupons.findMany({
      where: {
        is_active: true,
        applicable_to: { in: ['ALL', 'PRODUCTS'] },
        starts_at: { lte: now },
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      orderBy: { created_at: 'desc' },
    });

    const usages = coupons.length
      ? await this.prisma.coupon_usages.findMany({
          where: { coupon_id: { in: coupons.map((coupon) => coupon.id) }, user_id: userId },
          select: { coupon_id: true },
        })
      : [];
    const usageCounts = new Map<string, number>();
    for (const usage of usages) usageCounts.set(usage.coupon_id, (usageCounts.get(usage.coupon_id) ?? 0) + 1);
    const eligible = coupons.filter((coupon) =>
      (coupon.usage_limit === null || coupon.used_count < coupon.usage_limit) &&
      (usageCounts.get(coupon.id) ?? 0) < coupon.per_user_limit,
    );

    return eligible.map((coupon) => this.toPublic(coupon));
  }

  /** Validates a coupon for a given user/order value and returns the discount to apply. Does not record usage. */
  async validateForOrder(code: string, userId: string, orderValue: Prisma.Decimal) {
    const coupon = await this.prisma.coupons.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!coupon || !coupon.is_active) {
      throw new NotFoundException('Coupon not found or inactive');
    }

    const eligibilityError = productCouponEligibilityError(coupon, orderValue, new Date());
    if (eligibilityError) throw new BadRequestException(eligibilityError);

    const userUsageCount = await this.prisma.coupon_usages.count({ where: { coupon_id: coupon.id, user_id: userId } });
    if (userUsageCount >= coupon.per_user_limit) {
      throw new BadRequestException('You have already used this coupon the maximum number of times');
    }

    return {
      couponId: coupon.id,
      discount: calculateProductCouponDiscount(coupon, orderValue),
    };
  }

  /** Records a coupon's use against an order. Call after validateForOrder, inside the same order-creation transaction. */
  async recordUsage(couponId: string, userId: string, discount: number, orderId?: string) {
    await this.prisma.$transaction([
      this.prisma.coupon_usages.create({
        data: { coupon_id: couponId, user_id: userId, order_id: orderId, discount },
      }),
      this.prisma.coupons.update({ where: { id: couponId }, data: { used_count: { increment: 1 } } }),
    ]);
  }

  private async findOrThrow(id: string): Promise<coupons> {
    const coupon = await this.prisma.coupons.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return coupon;
  }

  private async getUsersById(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) {
      return new Map<string, { full_name: string; email: string | null }>();
    }
    const rows = await this.prisma.users.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, full_name: true, email: true },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private ensureCouponConfig(input: {
    discountType?: string;
    discountValue?: number;
    minOrderValue?: number;
    maxDiscount?: number;
    usageLimit?: number;
    perUserLimit?: number;
    startsAt?: string;
    expiresAt?: string;
  }) {
    if (input.discountType === 'PERCENTAGE' && (input.discountValue ?? 0) > 100) {
      throw new BadRequestException('Percentage coupon cannot exceed 100%');
    }
    if (input.expiresAt && input.startsAt && new Date(input.expiresAt) <= new Date(input.startsAt)) {
      throw new BadRequestException('Coupon expiry must be after its start date');
    }
    if (input.maxDiscount !== undefined && input.maxDiscount < 0) {
      throw new BadRequestException('Coupon maximum discount cannot be negative');
    }
    if (input.minOrderValue !== undefined && input.discountValue !== undefined && input.discountValue < 0) {
      throw new BadRequestException('Coupon discount cannot be negative');
    }
  }

  private toPublic(coupon: coupons) {
    return {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discount_type,
      discountValue: Number(coupon.discount_value),
      minOrderValue: Number(coupon.min_order_value),
      maxDiscount: coupon.max_discount === null ? null : Number(coupon.max_discount),
      usageLimit: coupon.usage_limit,
      usedCount: coupon.used_count,
      perUserLimit: coupon.per_user_limit,
      isActive: coupon.is_active,
      applicableTo: coupon.applicable_to,
      startsAt: coupon.starts_at,
      expiresAt: coupon.expires_at,
      createdAt: coupon.created_at,
      updatedAt: coupon.updated_at,
    };
  }
}
