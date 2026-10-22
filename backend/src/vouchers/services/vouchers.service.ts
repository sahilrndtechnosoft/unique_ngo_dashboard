import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  Prisma,
  voucher_status,
  vouchers,
} from '../../../generated/prisma/client';
import { PartnerAdapterFactory } from '../../partners/adapters/partner-adapter.factory';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminIssueVoucherDto,
  CancelVoucherDto,
  ListAllVouchersQueryDto,
  ListMyVouchersQueryDto,
  RedeemVoucherDto,
  VerifyVoucherDto,
} from '../dto/voucher.dto';

export interface IssueVoucherParams {
  userId: string;
  catalogItemId?: string;
  partnerStoreId?: string;
  title: string;
  description?: string;
  pointsSpent: number;
  monetaryValue: number;
  validityDays: number;
  partnerReference?: string;
  idempotencyKey?: string;
}

@Injectable()
export class VouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly partnerAdapterFactory: PartnerAdapterFactory,
  ) {}

  /**
   * Generates a collision-resistant, cryptographically secure voucher code.
   * Format: PREFIX-XXXX-XXXX (e.g. PH-7D9A-2K5M)
   */
  async generateSecureCode(prefix = 'VCH'): Promise<string> {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 Crockford (no 0, 1, I, O)
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = crypto.randomBytes(8);
      let p1 = '';
      let p2 = '';
      for (let i = 0; i < 4; i++) {
        p1 += chars[bytes[i] % chars.length];
        p2 += chars[bytes[i + 4] % chars.length];
      }
      const code = `${prefix.toUpperCase()}-${p1}-${p2}`;
      const existing = await this.prisma.vouchers.findUnique({ where: { code } });
      if (!existing) {
        return code;
      }
    }
    // Fallback using UUID hex chunk
    return `${prefix.toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  generateSecurityPin(): string {
    return crypto.randomInt(1000, 10000).toString();
  }

  /**
   * Issues a voucher inside an ongoing database transaction.
   */
  async issueVoucherInsideTx(
    tx: Prisma.TransactionClient,
    params: IssueVoucherParams,
  ): Promise<vouchers> {
    // If partner is configured, we can use their slug or custom code prefix
    let prefix = 'VCH';
    let partnerStore = null;
    if (params.partnerStoreId) {
      partnerStore = await tx.partner_stores.findUnique({
        where: { id: params.partnerStoreId },
      });
      if (partnerStore) {
        prefix = partnerStore.slug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'VCH';
      }
    }

    const code = await this.generateSecureCode(prefix);
    const securityPin = this.generateSecurityPin();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + params.validityDays * 24 * 60 * 60 * 1000);

    const qrPayload = JSON.stringify({
      vId: code,
      code,
      pin: securityPin,
      exp: expiresAt.toISOString(),
      val: params.monetaryValue,
    });

    const voucher = await tx.vouchers.create({
      data: {
        code,
        user_id: params.userId,
        catalog_item_id: params.catalogItemId,
        partner_store_id: params.partnerStoreId,
        title: params.title,
        description: params.description,
        points_spent: params.pointsSpent,
        monetary_value: new Prisma.Decimal(params.monetaryValue),
        status: voucher_status.ACTIVE,
        security_pin: securityPin,
        qr_payload: qrPayload,
        partner_reference: params.partnerReference,
        expires_at: expiresAt,
        idempotency_key: params.idempotencyKey,
      },
    });

    // Write audit log
    await tx.redemption_audit_logs.create({
      data: {
        event_type: 'VOUCHER_ISSUED',
        actor_type: 'SYSTEM',
        actor_id: params.userId,
        entity_type: 'VOUCHER',
        entity_id: voucher.id,
        metadata: {
          code: voucher.code,
          pointsSpent: params.pointsSpent,
          monetaryValue: params.monetaryValue,
          expiresAt: expiresAt.toISOString(),
          partnerStoreId: params.partnerStoreId,
        },
      },
    });

    return voucher;
  }

  /**
   * List vouchers belonging to the authenticated user.
   */
  async listMyVouchers(userId: string, query: ListMyVouchersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.vouchersWhereInput = {
      user_id: userId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.vouchers.count({ where }),
      this.prisma.vouchers.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    // Lazily evaluate expiry for any ACTIVE vouchers past expires_at
    const now = new Date();
    const expiredIds: string[] = [];
    const hydratedRows = rows.map((v) => {
      if (v.status === voucher_status.ACTIVE && v.expires_at < now) {
        expiredIds.push(v.id);
        return { ...v, status: voucher_status.EXPIRED };
      }
      return v;
    });

    if (expiredIds.length > 0) {
      await this.prisma.vouchers.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: voucher_status.EXPIRED, updated_at: now },
      });
    }

    // Attach partner info
    const partnerIds = hydratedRows
      .map((r) => r.partner_store_id)
      .filter((id): id is string => Boolean(id));

    const partners = partnerIds.length
      ? await this.prisma.partner_stores.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, name: true, slug: true, logo_url: true, website_url: true },
        })
      : [];
    const partnersMap = new Map(partners.map((p) => [p.id, p]));

    const items = hydratedRows.map((v) => ({
      ...this.toPublic(v),
      partnerStore: v.partner_store_id ? partnersMap.get(v.partner_store_id) ?? null : null,
    }));

    return {
      items,
      vouchers: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Get single voucher detail for the authenticated owner.
   */
  async getMyVoucherDetail(userId: string, voucherId: string) {
    const voucher = await this.prisma.vouchers.findUnique({
      where: { id: voucherId },
    });
    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }
    if (voucher.user_id !== userId) {
      throw new ForbiddenException('You do not have permission to view this voucher');
    }

    // Lazily evaluate expiry
    let status = voucher.status;
    if (status === voucher_status.ACTIVE && voucher.expires_at < new Date()) {
      status = voucher_status.EXPIRED;
      await this.prisma.vouchers.update({
        where: { id: voucher.id },
        data: { status: voucher_status.EXPIRED, updated_at: new Date() },
      });
    }

    const partnerStore = voucher.partner_store_id
      ? await this.prisma.partner_stores.findUnique({
          where: { id: voucher.partner_store_id },
        })
      : null;

    return {
      ...this.toPublic({ ...voucher, status }),
      partnerStore,
    };
  }

  /**
   * Cashier / POS / Partner verification of voucher code.
   */
  async verifyVoucher(dto: VerifyVoucherDto) {
    const code = dto.code.trim().toUpperCase();
    const voucher = await this.prisma.vouchers.findUnique({
      where: { code },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher code is invalid');
    }

    const now = new Date();
    if (voucher.status === voucher_status.ACTIVE && voucher.expires_at < now) {
      await this.prisma.vouchers.update({
        where: { id: voucher.id },
        data: { status: voucher_status.EXPIRED, updated_at: now },
      });
      return {
        isValid: false,
        reason: 'EXPIRED',
        message: 'This voucher has expired',
        voucher: this.toPublic({ ...voucher, status: voucher_status.EXPIRED }),
      };
    }

    if (voucher.status !== voucher_status.ACTIVE) {
      return {
        isValid: false,
        reason: voucher.status,
        message: `This voucher is ${voucher.status.toLowerCase()}`,
        voucher: this.toPublic(voucher),
      };
    }

    if (dto.securityPin && voucher.security_pin && dto.securityPin.trim() !== voucher.security_pin) {
      return {
        isValid: false,
        reason: 'INVALID_PIN',
        message: 'Security PIN does not match',
        voucher: null,
      };
    }

    const partnerStore = voucher.partner_store_id
      ? await this.prisma.partner_stores.findUnique({
          where: { id: voucher.partner_store_id },
          select: { id: true, name: true, slug: true, logo_url: true },
        })
      : null;

    return {
      isValid: true,
      reason: null,
      message: 'Voucher is active and ready for redemption',
      voucher: {
        ...this.toPublic(voucher),
        partnerStore,
      },
    };
  }

  /**
   * Cashier / POS redemption (burn voucher) with concurrency lock.
   */
  async redeemVoucher(
    dto: RedeemVoucherDto,
    redeemer?: { partnerId?: string; actorType?: string; actorId?: string },
  ) {
    const code = dto.code.trim().toUpperCase();

    return this.prisma.$transaction(async (tx) => {
      // Find voucher
      const existing = await tx.vouchers.findUnique({ where: { code } });
      if (!existing) {
        throw new NotFoundException('Voucher code not found');
      }

      // Lock row to prevent race condition/double-redemption
      await tx.$queryRaw`SELECT id FROM vouchers WHERE id = ${existing.id}::uuid FOR UPDATE`;

      const voucher = await tx.vouchers.findUnique({ where: { id: existing.id } });
      if (!voucher) throw new NotFoundException('Voucher not found');

      const now = new Date();
      if (voucher.status === voucher_status.REDEEMED) {
        throw new BadRequestException(
          `Voucher was already redeemed on ${voucher.redeemed_at?.toLocaleString() ?? 'earlier date'}`,
        );
      }
      if (voucher.status === voucher_status.EXPIRED || voucher.expires_at < now) {
        await tx.vouchers.update({
          where: { id: voucher.id },
          data: { status: voucher_status.EXPIRED, updated_at: now },
        });
        throw new BadRequestException('This voucher has expired and cannot be redeemed');
      }
      if (voucher.status !== voucher_status.ACTIVE) {
        throw new BadRequestException(`Voucher cannot be redeemed because it is ${voucher.status}`);
      }

      // Validate security PIN if required
      if (voucher.security_pin) {
        if (!dto.securityPin || dto.securityPin.trim() !== voucher.security_pin) {
          throw new BadRequestException('Valid security PIN is required to redeem this voucher');
        }
      }

      // If connected to a partner store, inform partner adapter
      if (voucher.partner_store_id) {
        const partner = await tx.partner_stores.findUnique({
          where: { id: voucher.partner_store_id },
        });
        if (partner && partner.adapter_type) {
          const adapter = this.partnerAdapterFactory.getAdapter(partner.adapter_type);
          const partnerResult = await adapter.redeemVoucher({
            partnerStoreId: partner.id,
            partnerStoreSlug: partner.slug,
            voucherCode: voucher.code,
            securityPin: dto.securityPin,
            storeLocation: dto.storeLocation,
            redeemedByPartnerId: redeemer?.partnerId,
            config: (partner.config as Record<string, unknown>) ?? null,
          });

          if (!partnerResult.success) {
            throw new BadRequestException(
              partnerResult.errorMessage ?? 'Partner rejected voucher redemption',
            );
          }
        }
      }

      const updated = await tx.vouchers.update({
        where: { id: voucher.id },
        data: {
          status: voucher_status.REDEEMED,
          redeemed_at: now,
          redeemed_store_location: dto.storeLocation?.trim(),
          redeemed_by_partner_id: redeemer?.partnerId,
          updated_at: now,
        },
      });

      // Audit log
      await tx.redemption_audit_logs.create({
        data: {
          event_type: 'VOUCHER_REDEEMED',
          actor_type: redeemer?.actorType ?? 'PARTNER',
          actor_id: redeemer?.actorId,
          entity_type: 'VOUCHER',
          entity_id: updated.id,
          metadata: {
            code: updated.code,
            monetaryValue: Number(updated.monetary_value),
            storeLocation: dto.storeLocation,
            redeemedAt: now.toISOString(),
          },
        },
      });

      return this.toPublic(updated);
    });
  }

  /**
   * Cancel / Void voucher (Admin or compensating rollback).
   */
  async cancelVoucher(voucherId: string, reason: string, adminUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.vouchers.findUnique({ where: { id: voucherId } });
      if (!voucher) throw new NotFoundException('Voucher not found');

      await tx.$queryRaw`SELECT id FROM vouchers WHERE id = ${voucher.id}::uuid FOR UPDATE`;

      if (voucher.status === voucher_status.REDEEMED) {
        throw new BadRequestException('Cannot cancel a voucher that has already been redeemed');
      }

      const updated = await tx.vouchers.update({
        where: { id: voucherId },
        data: {
          status: voucher_status.CANCELLED,
          updated_at: new Date(),
        },
      });

      await tx.redemption_audit_logs.create({
        data: {
          event_type: 'VOUCHER_CANCELLED',
          actor_type: adminUserId ? 'ADMIN' : 'SYSTEM',
          actor_id: adminUserId,
          entity_type: 'VOUCHER',
          entity_id: voucherId,
          metadata: { reason, code: voucher.code },
        },
      });

      return this.toPublic(updated);
    });
  }

  /**
   * Admin list vouchers.
   */
  async adminListVouchers(query: ListAllVouchersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.vouchersWhereInput = {
      ...(query.userId ? { user_id: query.userId } : {}),
      ...(query.partnerStoreId ? { partner_store_id: query.partnerStoreId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.vouchers.count({ where }),
      this.prisma.vouchers.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    // Hydrate users & partner stores
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const partnerIds = [...new Set(rows.map((r) => r.partner_store_id).filter((id): id is string => Boolean(id)))];

    const [users, partners] = await Promise.all([
      userIds.length
        ? this.prisma.users.findMany({
            where: { id: { in: userIds } },
            select: { id: true, full_name: true, email: true, mobile: true },
          })
        : [],
      partnerIds.length
        ? this.prisma.partner_stores.findMany({
            where: { id: { in: partnerIds } },
            select: { id: true, name: true, slug: true, logo_url: true },
          })
        : [],
    ]);

    const usersMap = new Map(
      users.map((u) => [
        u.id,
        { id: u.id, name: u.full_name, email: u.email, mobile: u.mobile },
      ]),
    );
    const partnersMap = new Map(partners.map((p) => [p.id, p]));

    const items = rows.map((v) => ({
      ...this.toPublic(v),
      user: usersMap.get(v.user_id) ?? null,
      partnerStore: v.partner_store_id ? partnersMap.get(v.partner_store_id) ?? null : null,
    }));

    return {
      items,
      vouchers: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Admin issue direct voucher.
   */
  async adminIssueVoucher(dto: AdminIssueVoucherDto, adminUserId: string) {
    const user = await this.prisma.users.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('Target user not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const voucher = await this.issueVoucherInsideTx(tx, {
        userId: dto.userId,
        partnerStoreId: dto.partnerStoreId,
        catalogItemId: dto.catalogItemId,
        title: dto.title,
        description: dto.description,
        pointsSpent: dto.pointsSpent,
        monetaryValue: dto.monetaryValue,
        validityDays: dto.validityDays ?? 30,
      });

      await tx.redemption_audit_logs.create({
        data: {
          event_type: 'ADMIN_VOUCHER_ISSUED',
          actor_type: 'ADMIN',
          actor_id: adminUserId,
          entity_type: 'VOUCHER',
          entity_id: voucher.id,
          metadata: {
            adminUserId,
            userId: dto.userId,
            title: dto.title,
            pointsSpent: dto.pointsSpent,
            monetaryValue: dto.monetaryValue,
          },
        },
      });

      return this.toPublic(voucher);
    });
  }

  private toPublic(voucher: vouchers) {
    return {
      id: voucher.id,
      code: voucher.code,
      userId: voucher.user_id,
      catalogItemId: voucher.catalog_item_id,
      partnerStoreId: voucher.partner_store_id,
      title: voucher.title,
      description: voucher.description,
      pointsSpent: voucher.points_spent,
      monetaryValue: Number(voucher.monetary_value),
      status: voucher.status,
      securityPin: voucher.security_pin,
      qrPayload: voucher.qr_payload,
      partnerReference: voucher.partner_reference,
      issuedAt: voucher.issued_at,
      expiresAt: voucher.expires_at,
      redeemedAt: voucher.redeemed_at,
      redeemedStoreLocation: voucher.redeemed_store_location,
      createdAt: voucher.created_at,
    };
  }
}
