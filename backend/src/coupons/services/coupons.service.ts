import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { coupons, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCouponDto, ListCouponsQueryDto, UpdateCouponDto } from '../dto/coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async adminCreate(dto: CreateCouponDto, createdById: string) {
    const code = dto.code.trim().toUpperCase();
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
    await this.findOrThrow(id);

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
    await this.prisma.coupons.delete({ where: { id } });
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
        starts_at: { lte: now },
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      orderBy: { created_at: 'desc' },
    });

    const eligible: coupons[] = [];
    for (const coupon of coupons) {
      if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
        continue;
      }
      const userUsageCount = await this.prisma.coupon_usages.count({ where: { coupon_id: coupon.id, user_id: userId } });
      if (userUsageCount >= coupon.per_user_limit) {
        continue;
      }
      eligible.push(coupon);
    }

    return eligible.map((coupon) => this.toPublic(coupon));
  }

  /** Validates a coupon for a given user/order value and returns the discount to apply. Does not record usage. */
  async validateForOrder(code: string, userId: string, orderValue: number) {
    const coupon = await this.prisma.coupons.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!coupon || !coupon.is_active) {
      throw new NotFoundException('Coupon not found or inactive');
    }

    const now = new Date();
    if (coupon.starts_at > now || (coupon.expires_at && coupon.expires_at <= now)) {
      throw new BadRequestException('Coupon is not currently valid');
    }
    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
      throw new BadRequestException('Coupon usage limit has been reached');
    }
    if (Number(coupon.min_order_value) > orderValue) {
      throw new BadRequestException(`Order value must be at least ${coupon.min_order_value} to use this coupon`);
    }

    const userUsageCount = await this.prisma.coupon_usages.count({ where: { coupon_id: coupon.id, user_id: userId } });
    if (userUsageCount >= coupon.per_user_limit) {
      throw new BadRequestException('You have already used this coupon the maximum number of times');
    }

    const rawDiscount =
      coupon.discount_type === 'FLAT' ? Number(coupon.discount_value) : (orderValue * Number(coupon.discount_value)) / 100;
    const discount = coupon.max_discount ? Math.min(rawDiscount, Number(coupon.max_discount)) : rawDiscount;

    return { couponId: coupon.id, discount: Math.min(discount, orderValue) };
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

  private toPublic(coupon: coupons) {
    return {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discount_type,
      discountValue: Number(coupon.discount_value),
      minOrderValue: Number(coupon.min_order_value),
      maxDiscount: coupon.max_discount ? Number(coupon.max_discount) : null,
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
