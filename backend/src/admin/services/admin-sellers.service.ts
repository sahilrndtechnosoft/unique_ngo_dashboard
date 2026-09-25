import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  seller_profiles,
  seller_status,
  user_role,
  user_status,
  users,
} from '../../../generated/prisma/client';
import { hashValue, normalizeMobile } from '../../common/utils/crypto.util';
import { deleteUploadedFile } from '../../common/utils/image-upload.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateAdminSellerDto,
  ListSellersQueryDto,
  UpdateAdminSellerDto,
} from '../dto/admin-seller.dto';

@Injectable()
export class AdminSellersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async listSellers(query: ListSellersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.seller_profilesWhereInput = {
      deleted_at: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                business_name: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.seller_profiles.count({ where }),
      this.prisma.seller_profiles.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const userIds = rows.map((row) => row.user_id);
    const userRows = await this.prisma.users.findMany({
      where: { id: { in: userIds }, deleted_at: null },
    });
    const usersById = new Map(userRows.map((user) => [user.id, user]));

    let items = rows.map((profile) =>
      this.toPublic(profile, usersById.get(profile.user_id) ?? null),
    );

    if (query.search) {
      const search = query.search.toLowerCase();
      items = items.filter(
        (item) =>
          item.businessName.toLowerCase().includes(search) ||
          item.fullName?.toLowerCase().includes(search) ||
          item.email?.toLowerCase().includes(search) ||
          item.mobile?.includes(search),
      );
    }

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getSeller(sellerId: string) {
    const profile = await this.findSellerOrThrow(sellerId);
    const user = await this.prisma.users.findFirst({
      where: { id: profile.user_id, deleted_at: null },
    });
    return this.toPublic(profile, user);
  }

  async getModerationHistory(sellerId: string) {
    await this.findSellerOrThrow(sellerId);
    return this.prisma.marketplace_moderation_events.findMany({
      where: { entity_type: 'SELLER', entity_id: sellerId },
      orderBy: { created_at: 'desc' },
    });
  }

  async createSeller(dto: CreateAdminSellerDto, actorId: string) {
    this.validatePickupOrigin(dto);
    const email = dto.email.toLowerCase();
    const mobile = normalizeMobile(dto.mobile);

    await this.ensureEmailAvailable(email);
    await this.ensureMobileAvailable(mobile);

    const passwordHash = await hashValue(
      dto.password,
      this.configService.get<number>('app.bcryptRounds')!,
    );

    const status = dto.status ?? seller_status.ACTIVE;

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          full_name: dto.fullName,
          email,
          mobile,
          password_hash: passwordHash,
          role: user_role.SELLER,
          status: user_status.ACTIVE,
          email_verified: true,
          mobile_verified: true,
        },
      });

      const profile = await tx.seller_profiles.create({
        data: {
          user_id: user.id,
          business_name: dto.businessName,
          business_type: dto.businessType,
          description: dto.description,
          gst_number: dto.gstNumber,
          pan_number: dto.panNumber,
          ...(dto.commissionRate !== undefined && { commission_rate: dto.commissionRate }),
          ...this.pickupOriginData(dto),
          status,
          verified_by_id:
            status === seller_status.ACTIVE ? actorId : undefined,
          verified_at:
            status === seller_status.ACTIVE ? new Date() : undefined,
        },
      });

      await tx.marketplace_moderation_events.create({
        data: {
          entity_type: 'SELLER',
          entity_id: profile.id,
          previous_status: null,
          new_status: status,
          actor_id: actorId,
          reason: null,
        },
      });

      return { user, profile };
    });

    return this.toPublic(result.profile, result.user);
  }

  async updateSeller(
    sellerId: string,
    dto: UpdateAdminSellerDto,
    actorId: string,
  ) {
    const profile = await this.findSellerOrThrow(sellerId);
    this.validatePickupOrigin({
      shiprocketPickupLocation: dto.shiprocketPickupLocation !== undefined ? dto.shiprocketPickupLocation : profile.shiprocket_pickup_location,
      shiprocketPickupAddress: dto.shiprocketPickupAddress !== undefined ? dto.shiprocketPickupAddress : profile.shiprocket_pickup_address,
      shiprocketPickupAddress2: dto.shiprocketPickupAddress2 !== undefined ? dto.shiprocketPickupAddress2 : profile.shiprocket_pickup_address_2,
      shiprocketPickupCity: dto.shiprocketPickupCity !== undefined ? dto.shiprocketPickupCity : profile.shiprocket_pickup_city,
      shiprocketPickupState: dto.shiprocketPickupState !== undefined ? dto.shiprocketPickupState : profile.shiprocket_pickup_state,
      shiprocketPickupCountry: dto.shiprocketPickupCountry !== undefined ? dto.shiprocketPickupCountry : profile.shiprocket_pickup_country,
      shiprocketPickupPinCode: dto.shiprocketPickupPinCode !== undefined ? dto.shiprocketPickupPinCode : profile.shiprocket_pickup_pin_code,
    });
    const user = await this.prisma.users.findFirst({
      where: { id: profile.user_id, deleted_at: null },
    });

    if (!user) {
      throw new NotFoundException('Seller user account not found');
    }

    if (dto.email && dto.email.toLowerCase() !== user.email?.toLowerCase()) {
      await this.ensureEmailAvailable(dto.email.toLowerCase(), user.id);
    }

    const mobile = dto.mobile ? normalizeMobile(dto.mobile) : undefined;
    if (mobile && mobile !== user.mobile) {
      await this.ensureMobileAvailable(mobile, user.id);
    }

    const userData: Prisma.usersUpdateInput = {
      ...(dto.fullName !== undefined && { full_name: dto.fullName }),
      ...(dto.email !== undefined && { email: dto.email.toLowerCase() }),
      ...(dto.mobile !== undefined && { mobile }),
      updated_at: new Date(),
    };

    if (dto.password) {
      userData.password_hash = await hashValue(
        dto.password,
        this.configService.get<number>('app.bcryptRounds')!,
      );
    }

    const profileData: Prisma.seller_profilesUpdateInput = {
      ...(dto.businessName !== undefined && {
        business_name: dto.businessName,
      }),
      ...(dto.businessType !== undefined && {
        business_type: dto.businessType,
      }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.gstNumber !== undefined && { gst_number: dto.gstNumber }),
      ...(dto.panNumber !== undefined && { pan_number: dto.panNumber }),
      ...(dto.commissionRate !== undefined && {
        commission_rate: dto.commissionRate,
      }),
      ...this.pickupOriginData(dto),
      updated_at: new Date(),
    };

    if (dto.status !== undefined) {
      this.assertStatusTransition(profile.status, dto.status);
      if (dto.status === seller_status.REJECTED && !dto.rejectionReason?.trim()) {
        throw new BadRequestException('A rejection reason is required');
      }
      profileData.status = dto.status;
      if (dto.status === seller_status.ACTIVE) {
        profileData.verified_by_id = actorId;
        profileData.verified_at = new Date();
        profileData.rejection_reason = null;
      }
      if (dto.status === seller_status.REJECTED) {
        profileData.rejection_reason = dto.rejectionReason ?? 'Rejected by admin';
      }
      if (dto.status === seller_status.SUSPENDED) {
        profileData.rejection_reason = dto.rejectionReason ?? null;
      }
      if (dto.status !== seller_status.ACTIVE) {
        profileData.verified_by_id = null;
        profileData.verified_at = null;
      }
    } else if (dto.rejectionReason !== undefined) {
      profileData.rejection_reason = dto.rejectionReason;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const [updatedUser, updatedProfile] = await Promise.all([
        tx.users.update({ where: { id: user.id }, data: userData }),
        tx.seller_profiles.update({ where: { id: sellerId }, data: profileData }),
      ]);
      if (dto.status && dto.status !== profile.status) {
        await tx.marketplace_moderation_events.create({
          data: {
            entity_type: 'SELLER',
            entity_id: sellerId,
            previous_status: profile.status,
            new_status: dto.status,
            actor_id: actorId,
            reason: dto.rejectionReason?.trim() || null,
          },
        });
      }
      return { updatedUser, updatedProfile };
    });

    return this.toPublic(result.updatedProfile, result.updatedUser);
  }

  private assertStatusTransition(from: seller_status, to: seller_status) {
    if (from === to) return;
    const allowed: Record<seller_status, seller_status[]> = {
      [seller_status.PENDING]: [seller_status.UNDER_REVIEW, seller_status.ACTIVE, seller_status.REJECTED, seller_status.SUSPENDED],
      [seller_status.UNDER_REVIEW]: [seller_status.ACTIVE, seller_status.REJECTED, seller_status.SUSPENDED],
      [seller_status.REJECTED]: [seller_status.UNDER_REVIEW, seller_status.ACTIVE, seller_status.SUSPENDED],
      [seller_status.ACTIVE]: [seller_status.SUSPENDED],
      [seller_status.SUSPENDED]: [seller_status.UNDER_REVIEW, seller_status.ACTIVE],
    };
    if (!allowed[from].includes(to)) {
      throw new BadRequestException(`Invalid seller status transition: ${from} -> ${to}`);
    }
  }

  async updateProfilePicture(sellerId: string, filePath: string) {
    const profile = await this.findSellerOrThrow(sellerId);
    const user = await this.prisma.users.findFirst({
      where: { id: profile.user_id, deleted_at: null },
    });

    if (!user) {
      throw new NotFoundException('Seller user account not found');
    }

    deleteUploadedFile(user.profile_image_url);

    const updatedUser = await this.prisma.users.update({
      where: { id: user.id },
      data: { profile_image_url: filePath, updated_at: new Date() },
    });

    return this.toPublic(profile, updatedUser);
  }

  async deleteSeller(sellerId: string) {
    const profile = await this.findSellerOrThrow(sellerId);

    await this.prisma.$transaction([
      this.prisma.seller_profiles.update({
        where: { id: sellerId },
        data: {
          deleted_at: new Date(),
          status: seller_status.SUSPENDED,
          updated_at: new Date(),
        },
      }),
      this.prisma.users.update({
        where: { id: profile.user_id },
        data: {
          deleted_at: new Date(),
          status: user_status.INACTIVE,
          updated_at: new Date(),
        },
      }),
    ]);
  }

  private async findSellerOrThrow(sellerId: string) {
    const profile = await this.prisma.seller_profiles.findFirst({
      where: { id: sellerId, deleted_at: null },
    });

    if (!profile) {
      throw new NotFoundException('Seller not found');
    }

    return profile;
  }

  private async ensureEmailAvailable(email: string, excludeId?: string) {
    const existing = await this.prisma.users.findFirst({
      where: {
        email,
        deleted_at: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException('Email is already in use');
    }
  }

  private async ensureMobileAvailable(mobile: string, excludeId?: string) {
    const existing = await this.prisma.users.findFirst({
      where: {
        mobile,
        deleted_at: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException('Mobile number is already in use');
    }
  }

  private validatePickupOrigin(origin: {
    shiprocketPickupLocation?: string | null;
    shiprocketPickupAddress?: string | null;
    shiprocketPickupAddress2?: string | null;
    shiprocketPickupCity?: string | null;
    shiprocketPickupState?: string | null;
    shiprocketPickupCountry?: string | null;
    shiprocketPickupPinCode?: string | null;
  }) {
    const fields = [origin.shiprocketPickupLocation, origin.shiprocketPickupAddress,
      origin.shiprocketPickupCity, origin.shiprocketPickupState, origin.shiprocketPickupPinCode];
    if (fields.every((value) => !value?.trim())) return;
    if (fields.some((value) => !value?.trim())) {
      throw new BadRequestException('Complete the Shiprocket pickup location, address, city, state and six-digit postal code, or leave them all blank');
    }
    if (origin.shiprocketPickupAddress!.trim().length < 10) {
      throw new BadRequestException('Shiprocket pickup address must contain at least 10 characters');
    }
  }

  private pickupOriginData(dto: {
    shiprocketPickupLocation?: string | null;
    shiprocketPickupAddress?: string | null;
    shiprocketPickupAddress2?: string | null;
    shiprocketPickupCity?: string | null;
    shiprocketPickupState?: string | null;
    shiprocketPickupCountry?: string | null;
    shiprocketPickupPinCode?: string | null;
  }): {
    shiprocket_pickup_location?: string | null;
    shiprocket_pickup_address?: string | null;
    shiprocket_pickup_address_2?: string | null;
    shiprocket_pickup_city?: string | null;
    shiprocket_pickup_state?: string | null;
    shiprocket_pickup_country?: string | null;
    shiprocket_pickup_pin_code?: string | null;
  } {
    return {
      ...(dto.shiprocketPickupLocation !== undefined && { shiprocket_pickup_location: dto.shiprocketPickupLocation?.trim() || null }),
      ...(dto.shiprocketPickupAddress !== undefined && { shiprocket_pickup_address: dto.shiprocketPickupAddress?.trim() || null }),
      ...(dto.shiprocketPickupAddress2 !== undefined && { shiprocket_pickup_address_2: dto.shiprocketPickupAddress2?.trim() || null }),
      ...(dto.shiprocketPickupCity !== undefined && { shiprocket_pickup_city: dto.shiprocketPickupCity?.trim() || null }),
      ...(dto.shiprocketPickupState !== undefined && { shiprocket_pickup_state: dto.shiprocketPickupState?.trim() || null }),
      ...(dto.shiprocketPickupCountry !== undefined && { shiprocket_pickup_country: dto.shiprocketPickupCountry?.trim() || null }),
      ...(dto.shiprocketPickupPinCode !== undefined && { shiprocket_pickup_pin_code: dto.shiprocketPickupPinCode?.trim() || null }),
    };
  }

  private toPublic(profile: seller_profiles, user: users | null) {
    return {
      id: profile.id,
      userId: profile.user_id,
      fullName: user?.full_name ?? null,
      email: user?.email ?? null,
      mobile: user?.mobile ?? null,
      profilePicture: user?.profile_image_url ?? null,
      businessName: profile.business_name,
      businessType: profile.business_type,
      description: profile.description,
      gstNumber: profile.gst_number,
      panNumber: profile.pan_number,
      status: profile.status,
      isPremium: profile.is_premium,
      rating: Number(profile.rating),
      totalSales: profile.total_sales,
      commissionRate:
        profile.commission_rate === null ? null : Number(profile.commission_rate),
      shiprocketPickupLocation: profile.shiprocket_pickup_location,
      shiprocketPickupAddress: profile.shiprocket_pickup_address,
      shiprocketPickupAddress2: profile.shiprocket_pickup_address_2,
      shiprocketPickupCity: profile.shiprocket_pickup_city,
      shiprocketPickupState: profile.shiprocket_pickup_state,
      shiprocketPickupCountry: profile.shiprocket_pickup_country,
      shiprocketPickupPinCode: profile.shiprocket_pickup_pin_code,
      rejectionReason: profile.rejection_reason,
      verifiedAt: profile.verified_at,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }
}
