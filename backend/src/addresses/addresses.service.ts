import { Injectable, NotFoundException } from '@nestjs/common';
import { user_addresses } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAddresses(userId: string) {
    const addresses = await this.prisma.user_addresses.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
    return addresses.map((address) => this.toPublic(address));
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.clearDefault(userId);
    }

    const existingCount = await this.prisma.user_addresses.count({
      where: { user_id: userId, deleted_at: null },
    });

    const address = await this.prisma.user_addresses.create({
      data: {
        user_id: userId,
        label: dto.label,
        full_name: dto.fullName,
        mobile: dto.mobile,
        address_line1: dto.addressLine1,
        address_line2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postal_code: dto.postalCode,
        country: dto.country ?? 'India',
        is_default: dto.isDefault ?? existingCount === 0,
      },
    });

    return this.toPublic(address);
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    await this.findAddressOrThrow(userId, addressId);

    if (dto.isDefault) {
      await this.clearDefault(userId);
    }

    const updated = await this.prisma.user_addresses.update({
      where: { id: addressId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.fullName !== undefined && { full_name: dto.fullName }),
        ...(dto.mobile !== undefined && { mobile: dto.mobile }),
        ...(dto.addressLine1 !== undefined && {
          address_line1: dto.addressLine1,
        }),
        ...(dto.addressLine2 !== undefined && {
          address_line2: dto.addressLine2,
        }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.postalCode !== undefined && { postal_code: dto.postalCode }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.isDefault !== undefined && { is_default: dto.isDefault }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.findAddressOrThrow(userId, addressId);

    await this.prisma.user_addresses.update({
      where: { id: addressId },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });

    return { id: address.id };
  }

  async ensureOwnedAddress(userId: string, addressId: string) {
    return this.findAddressOrThrow(userId, addressId);
  }

  private async findAddressOrThrow(userId: string, addressId: string) {
    const address = await this.prisma.user_addresses.findFirst({
      where: { id: addressId, user_id: userId, deleted_at: null },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return address;
  }

  private async clearDefault(userId: string) {
    await this.prisma.user_addresses.updateMany({
      where: { user_id: userId, deleted_at: null, is_default: true },
      data: { is_default: false },
    });
  }

  private toPublic(address: user_addresses) {
    return {
      id: address.id,
      label: address.label,
      fullName: address.full_name,
      mobile: address.mobile,
      addressLine1: address.address_line1,
      addressLine2: address.address_line2,
      city: address.city,
      state: address.state,
      postalCode: address.postal_code,
      country: address.country,
      isDefault: address.is_default,
      createdAt: address.created_at,
      updatedAt: address.updated_at,
    };
  }
}
