import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { seller_profiles, users } from '../../generated/prisma/client';
import { UserRole } from '../common/constants';
import { compareHash, hashValue } from '../common/utils/crypto.util';
import { deleteUploadedFile } from '../common/utils/image-upload.util';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicSeller } from '../auth/mappers/user.mapper';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSellerProfileDto } from './dto/update-seller-profile.dto';

export interface PublicUserProfile {
  id: string;
  role: string;
  status: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  mobileVerified: boolean;
  emailVerified: boolean;
  gender: string | null;
  bloodGroup: string | null;
  bio: string | null;
  profilePicture: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  toPublicProfile(
    user: users,
    address?: {
      address_line1: string;
      city: string;
      state: string;
      postal_code: string;
    } | null,
  ): PublicUserProfile {
    return {
      id: user.id,
      role: user.role,
      status: user.status,
      fullName: user.full_name,
      email: user.email,
      mobile: user.mobile,
      mobileVerified: user.mobile_verified,
      emailVerified: user.email_verified,
      gender: user.gender,
      bloodGroup: user.blood_group,
      bio: user.bio,
      profilePicture: user.profile_image_url,
      address: address?.address_line1 ?? null,
      city: address?.city ?? null,
      state: address?.state ?? null,
      postalCode: address?.postal_code ?? null,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async getProfile(userId: string): Promise<PublicUserProfile> {
    const user = await this.findUserOrThrow(userId);
    const defaultAddress = await this.getDefaultAddress(userId);
    return this.toPublicProfile(user, defaultAddress);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUserProfile> {
    const user = await this.findUserOrThrow(userId);

    if (dto.email && dto.email.toLowerCase() !== user.email?.toLowerCase()) {
      await this.ensureEmailAvailable(dto.email, userId);
    }

    const updateData: {
      full_name?: string;
      email?: string;
      email_verified?: boolean;
      bio?: string | null;
      gender?: users['gender'];
      blood_group?: users['blood_group'];
      profile_image_url?: string | null;
      password_hash?: string;
    } = {};
    if (dto.fullName !== undefined) updateData.full_name = dto.fullName;
    if (dto.email !== undefined) {
      updateData.email = dto.email.toLowerCase();
      updateData.email_verified = false;
    }
    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.gender !== undefined) updateData.gender = dto.gender;
    if (dto.bloodGroup !== undefined) updateData.blood_group = dto.bloodGroup;
    if (dto.profilePicture !== undefined) {
      updateData.profile_image_url = dto.profilePicture;
    }
    if (dto.password) {
      if (
        !dto.currentPassword ||
        !user.password_hash ||
        !(await compareHash(dto.currentPassword, user.password_hash))
      ) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      updateData.password_hash = await hashValue(
        dto.password,
        this.configService.get<number>('app.bcryptRounds')!,
      );
    }

    const updatedUser = await this.prisma.users.update({
      where: { id: userId },
      data: updateData,
    });

    const defaultAddress = await this.upsertDefaultAddress(
      userId,
      updatedUser,
      dto,
    );

    return this.toPublicProfile(updatedUser, defaultAddress);
  }

  async updateProfilePicture(
    userId: string,
    filePath: string,
  ): Promise<PublicUserProfile> {
    const existing = await this.findUserOrThrow(userId);
    deleteUploadedFile(existing.profile_image_url);

    const user = await this.prisma.users.update({
      where: { id: userId },
      data: { profile_image_url: filePath },
    });

    const defaultAddress = await this.getDefaultAddress(userId);
    return this.toPublicProfile(user, defaultAddress);
  }

  async getSellerProfile(userId: string, role: UserRole) {
    this.ensureSellerRole(role);
    const profile = await this.findSellerProfileOrThrow(userId);
    return toPublicSeller(profile, true);
  }

  async updateSellerProfile(
    userId: string,
    role: UserRole,
    dto: UpdateSellerProfileDto,
  ) {
    this.ensureSellerRole(role);
    const profile = await this.findSellerProfileOrThrow(userId);

    const updated = await this.prisma.seller_profiles.update({
      where: { id: profile.id },
      data: {
        ...(dto.businessName !== undefined && {
          business_name: dto.businessName,
        }),
        ...(dto.businessType !== undefined && {
          business_type: dto.businessType,
        }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.gstNumber !== undefined && { gst_number: dto.gstNumber }),
        ...(dto.panNumber !== undefined && { pan_number: dto.panNumber }),
        ...(dto.logoUrl !== undefined && { logo_url: dto.logoUrl }),
        ...(dto.bannerUrl !== undefined && { banner_url: dto.bannerUrl }),
        ...(dto.bankAccountNo !== undefined && {
          bank_account_no: dto.bankAccountNo,
        }),
        ...(dto.bankIfsc !== undefined && { bank_ifsc: dto.bankIfsc }),
        ...(dto.bankName !== undefined && { bank_name: dto.bankName }),
        ...(dto.bankAccountName !== undefined && {
          bank_account_name: dto.bankAccountName,
        }),
        ...(dto.upiId !== undefined && { upi_id: dto.upiId }),
      },
    });

    return toPublicSeller(updated, true);
  }

  private async findUserOrThrow(userId: string): Promise<users> {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async ensureEmailAvailable(
    email: string,
    userId: string,
  ): Promise<void> {
    const existingEmail = await this.prisma.users.findFirst({
      where: {
        email: email.toLowerCase(),
        deleted_at: null,
        NOT: { id: userId },
      },
    });

    if (existingEmail) {
      throw new ConflictException('Email is already in use');
    }
  }

  private async getDefaultAddress(userId: string) {
    return this.prisma.user_addresses.findFirst({
      where: { user_id: userId, deleted_at: null, is_default: true },
      orderBy: { updated_at: 'desc' },
    });
  }

  private async upsertDefaultAddress(
    userId: string,
    user: users,
    dto: UpdateProfileDto,
  ) {
    const hasAddressFields =
      dto.address !== undefined ||
      dto.city !== undefined ||
      dto.state !== undefined ||
      dto.postalCode !== undefined;

    if (!hasAddressFields) {
      return this.getDefaultAddress(userId);
    }

    const defaultAddress = await this.getDefaultAddress(userId);

    if (defaultAddress) {
      return this.prisma.user_addresses.update({
        where: { id: defaultAddress.id },
        data: {
          ...(dto.address !== undefined && { address_line1: dto.address }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.state !== undefined && { state: dto.state }),
          ...(dto.postalCode !== undefined && { postal_code: dto.postalCode }),
        },
      });
    }

    if (!dto.address || !dto.city || !dto.state || !dto.postalCode) {
      throw new ConflictException(
        'Provide address, city, state, and postalCode to create a new address',
      );
    }

    return this.prisma.user_addresses.create({
      data: {
        user_id: userId,
        full_name: user.full_name,
        mobile: user.mobile ?? '0000000000',
        address_line1: dto.address,
        city: dto.city,
        state: dto.state,
        postal_code: dto.postalCode,
        is_default: true,
      },
    });
  }

  private ensureSellerRole(role: UserRole): void {
    if (role !== UserRole.SELLER) {
      throw new ForbiddenException('Seller profile is only available for sellers');
    }
  }

  private async findSellerProfileOrThrow(
    userId: string,
  ): Promise<seller_profiles> {
    const profile = await this.prisma.seller_profiles.findFirst({
      where: { user_id: userId, deleted_at: null },
    });

    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }

    return profile;
  }
}
