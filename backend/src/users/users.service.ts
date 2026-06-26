import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { users } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface PublicUserProfile {
  id: string;
  role: string;
  status: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  mobileVerified: boolean;
  emailVerified: boolean;
  bloodGroup: string | null;
  profilePicture: string | null;
  bio: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  toPublicProfile(
    user: users,
    address?: {
      address_line1: string;
      city: string;
      state: string;
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
      bloodGroup: user.blood_group,
      profilePicture: user.profile_image_url,
      bio: user.bio,
      address: address?.address_line1 ?? null,
      city: address?.city ?? null,
      state: address?.state ?? null,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async getProfile(userId: string): Promise<PublicUserProfile> {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const defaultAddress = await this.prisma.user_addresses.findFirst({
      where: { user_id: userId, deleted_at: null, is_default: true },
      orderBy: { updated_at: 'desc' },
    });

    return this.toPublicProfile(user, defaultAddress);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUserProfile> {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email.toLowerCase() !== user.email?.toLowerCase()) {
      const existingEmail = await this.prisma.users.findFirst({
        where: {
          email: dto.email.toLowerCase(),
          deleted_at: null,
          NOT: { id: userId },
        },
      });

      if (existingEmail) {
        throw new ConflictException('Email is already in use');
      }
    }

    const updatedUser = await this.prisma.users.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined && { full_name: dto.fullName }),
        ...(dto.email !== undefined && {
          email: dto.email.toLowerCase(),
          email_verified: false,
        }),
        ...(dto.bloodGroup !== undefined && { blood_group: dto.bloodGroup }),
        ...(dto.profilePicture !== undefined && {
          profile_image_url: dto.profilePicture,
        }),
      },
    });

    let defaultAddress = await this.prisma.user_addresses.findFirst({
      where: { user_id: userId, deleted_at: null, is_default: true },
    });

    if (dto.address || dto.city || dto.state) {
      if (defaultAddress) {
        defaultAddress = await this.prisma.user_addresses.update({
          where: { id: defaultAddress.id },
          data: {
            ...(dto.address !== undefined && { address_line1: dto.address }),
            ...(dto.city !== undefined && { city: dto.city }),
            ...(dto.state !== undefined && { state: dto.state }),
          },
        });
      } else if (dto.address && dto.city && dto.state) {
        defaultAddress = await this.prisma.user_addresses.create({
          data: {
            user_id: userId,
            full_name: updatedUser.full_name,
            mobile: updatedUser.mobile ?? '0000000000',
            address_line1: dto.address,
            city: dto.city,
            state: dto.state,
            postal_code: '000000',
            is_default: true,
          },
        });
      }
    }

    return this.toPublicProfile(updatedUser, defaultAddress);
  }

  async updateProfilePicture(
    userId: string,
    fileUrl: string,
  ): Promise<PublicUserProfile> {
    const user = await this.prisma.users.update({
      where: { id: userId },
      data: { profile_image_url: fileUrl },
    });

    const defaultAddress = await this.prisma.user_addresses.findFirst({
      where: { user_id: userId, deleted_at: null, is_default: true },
    });

    return this.toPublicProfile(user, defaultAddress);
  }
}
