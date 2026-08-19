import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  donation_item_images,
  donation_item_status,
  donation_items,
  Prisma,
  users,
} from '../../../generated/prisma/client';
import { maskMobile } from '../../common/utils/crypto.util';
import { deleteUploadedFile } from '../../common/utils/image-upload.util';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminListDonationItemsQueryDto,
  AdminUpdateDonationItemDto,
  CreateDonationItemDto,
  ListDonationItemsQueryDto,
  RejectDonationItemDto,
  UpdateDonationItemDto,
} from '../dto/donation-item.dto';

const EDITABLE_STATUSES: donation_item_status[] = [donation_item_status.AVAILABLE];

@Injectable()
export class DonationItemsService {
  private readonly logger = new Logger(DonationItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(donorId: string, dto: CreateDonationItemDto) {
    const item = await this.prisma.donation_items.create({
      data: {
        donor_id: donorId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        condition: dto.condition ?? 'GOOD',
        quantity: dto.quantity ?? 1,
        pickup_city: dto.pickupCity,
        pickup_state: dto.pickupState,
        pickup_address: dto.pickupAddress,
        is_pickup_only: dto.isPickupOnly ?? true,
        tags: dto.tags ?? [],
      },
    });

    return this.toPublic(item, undefined, []);
  }

  async listPublic(query: ListDonationItemsQueryDto) {
    return this.list(query, {
      verifiedOnly: true,
      statusDefault: donation_item_status.AVAILABLE,
    });
  }

  async listMine(donorId: string, query: ListDonationItemsQueryDto) {
    return this.list(query, { donorId });
  }

  async adminList(query: AdminListDonationItemsQueryDto) {
    return this.list(query, {
      donorId: query.donorId,
      verified: query.verified,
    });
  }

  async getPublic(itemId: string, viewerId?: string) {
    const item = await this.findOrThrow(itemId, {
      verifiedOnly: viewerId ? undefined : true,
    });

    if (!item.verified_at && item.donor_id !== viewerId) {
      throw new NotFoundException('Donation item not found');
    }

    const [donor, images] = await Promise.all([
      this.prisma.users.findUnique({ where: { id: item.donor_id } }),
      this.getImages(itemId),
    ]);

    return this.toPublic(item, donor ?? undefined, images);
  }

  async getMine(donorId: string, itemId: string) {
    const item = await this.findOrThrow(itemId, { donorId });
    const images = await this.getImages(itemId);
    return this.toPublic(item, undefined, images);
  }

  async adminGet(itemId: string) {
    const item = await this.findOrThrow(itemId);
    const [donor, images] = await Promise.all([
      this.prisma.users.findUnique({ where: { id: item.donor_id } }),
      this.getImages(itemId),
    ]);
    return this.toPublic(item, donor ?? undefined, images);
  }

  async update(donorId: string, itemId: string, dto: UpdateDonationItemDto) {
    const item = await this.findOrThrow(itemId, { donorId });

    if (!EDITABLE_STATUSES.includes(item.status)) {
      throw new BadRequestException(
        'This item can no longer be edited because it has already been requested or transferred',
      );
    }

    const updated = await this.prisma.donation_items.update({
      where: { id: itemId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.condition !== undefined && { condition: dto.condition }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.pickupCity !== undefined && { pickup_city: dto.pickupCity }),
        ...(dto.pickupState !== undefined && { pickup_state: dto.pickupState }),
        ...(dto.pickupAddress !== undefined && { pickup_address: dto.pickupAddress }),
        ...(dto.isPickupOnly !== undefined && { is_pickup_only: dto.isPickupOnly }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        // Editing a previously verified listing should go through moderation again.
        verified_by_id: null,
        verified_at: null,
        updated_at: new Date(),
      },
    });

    const images = await this.getImages(itemId);
    return this.toPublic(updated, undefined, images);
  }

  async cancel(donorId: string, itemId: string) {
    const item = await this.findOrThrow(itemId, { donorId });

    if (item.status === donation_item_status.TRANSFERRED) {
      throw new BadRequestException('This item has already been transferred');
    }

    const updated = await this.prisma.donation_items.update({
      where: { id: itemId },
      data: { status: donation_item_status.CANCELLED, updated_at: new Date() },
    });

    return this.toPublic(updated, undefined, []);
  }

  async adminUpdate(itemId: string, dto: AdminUpdateDonationItemDto) {
    await this.findOrThrow(itemId);

    const updated = await this.prisma.donation_items.update({
      where: { id: itemId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.condition !== undefined && { condition: dto.condition }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.pickupCity !== undefined && { pickup_city: dto.pickupCity }),
        ...(dto.pickupState !== undefined && { pickup_state: dto.pickupState }),
        ...(dto.pickupAddress !== undefined && { pickup_address: dto.pickupAddress }),
        ...(dto.isPickupOnly !== undefined && { is_pickup_only: dto.isPickupOnly }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.adminNote !== undefined && { admin_note: dto.adminNote }),
        updated_at: new Date(),
      },
    });

    const images = await this.getImages(itemId);
    return this.toPublic(updated, undefined, images);
  }

  async verify(itemId: string, adminId: string) {
    const item = await this.findOrThrow(itemId);

    const updated = await this.prisma.donation_items.update({
      where: { id: itemId },
      data: { verified_by_id: adminId, verified_at: new Date(), admin_note: null, updated_at: new Date() },
    });

    await this.notifyDonor(item.donor_id, 'Listing Approved', `Your donation listing "${item.title}" has been approved and is now visible to others.`, item.id);

    const images = await this.getImages(itemId);
    return this.toPublic(updated, undefined, images);
  }

  async reject(itemId: string, dto: RejectDonationItemDto, adminId: string) {
    const item = await this.findOrThrow(itemId);

    const updated = await this.prisma.donation_items.update({
      where: { id: itemId },
      data: {
        verified_by_id: adminId,
        verified_at: null,
        admin_note: dto.adminNote,
        updated_at: new Date(),
      },
    });

    await this.notifyDonor(item.donor_id, 'Listing Needs Changes', `Your donation listing "${item.title}" was not approved: ${dto.adminNote}`, item.id);

    const images = await this.getImages(itemId);
    return this.toPublic(updated, undefined, images);
  }

  async adminDelete(itemId: string) {
    await this.findOrThrow(itemId);
    await this.prisma.donation_items.update({
      where: { id: itemId },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }

  async addImage(donorId: string | undefined, itemId: string, imagePath: string, isPrimary?: boolean) {
    await this.findOrThrow(itemId, donorId ? { donorId } : undefined);

    if (isPrimary) {
      await this.prisma.donation_item_images.updateMany({
        where: { donation_item_id: itemId },
        data: { is_primary: false },
      });
    }

    const count = await this.prisma.donation_item_images.count({
      where: { donation_item_id: itemId },
    });

    const image = await this.prisma.donation_item_images.create({
      data: {
        donation_item_id: itemId,
        url: imagePath,
        sort_order: count,
        is_primary: isPrimary || count === 0,
      },
    });

    return this.toPublicImage(image);
  }

  async removeImage(donorId: string | undefined, itemId: string, imageId: string) {
    await this.findOrThrow(itemId, donorId ? { donorId } : undefined);

    const image = await this.prisma.donation_item_images.findFirst({
      where: { id: imageId, donation_item_id: itemId },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    deleteUploadedFile(image.url);
    await this.prisma.donation_item_images.delete({ where: { id: imageId } });

    if (image.is_primary) {
      const next = await this.prisma.donation_item_images.findFirst({
        where: { donation_item_id: itemId },
        orderBy: { sort_order: 'asc' },
      });
      if (next) {
        await this.prisma.donation_item_images.update({
          where: { id: next.id },
          data: { is_primary: true },
        });
      }
    }
  }

  private async list(
    query: ListDonationItemsQueryDto,
    options: {
      donorId?: string;
      verifiedOnly?: boolean;
      verified?: boolean;
      statusDefault?: donation_item_status;
    } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.donation_itemsWhereInput = {
      deleted_at: null,
      ...(options.donorId ? { donor_id: options.donorId } : {}),
      ...(options.verifiedOnly ? { verified_at: { not: null } } : {}),
      ...(options.verified === true ? { verified_at: { not: null } } : {}),
      ...(options.verified === false ? { verified_at: null } : {}),
      status: query.status ?? options.statusDefault,
      ...(query.category ? { category: query.category } : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.city ? { pickup_city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.state ? { pickup_state: { equals: query.state, mode: 'insensitive' } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (!where.status) {
      delete where.status;
    }

    const [total, rows] = await Promise.all([
      this.prisma.donation_items.count({ where }),
      this.prisma.donation_items.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
    ]);

    const [donorsById, imagesByItem] = await Promise.all([
      this.getUsersById(rows.map((row) => row.donor_id)),
      this.getImagesForItems(rows.map((row) => row.id)),
    ]);

    return {
      items: rows.map((row) => this.toPublic(row, donorsById.get(row.donor_id), imagesByItem.get(row.id) ?? [])),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  private async getImages(itemId: string): Promise<donation_item_images[]> {
    return this.prisma.donation_item_images.findMany({
      where: { donation_item_id: itemId },
      orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
    });
  }

  private async getImagesForItems(itemIds: string[]) {
    const uniqueIds = [...new Set(itemIds)];
    const map = new Map<string, donation_item_images[]>();
    if (uniqueIds.length === 0) {
      return map;
    }

    const rows = await this.prisma.donation_item_images.findMany({
      where: { donation_item_id: { in: uniqueIds } },
      orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
    });

    for (const row of rows) {
      const list = map.get(row.donation_item_id) ?? [];
      list.push(row);
      map.set(row.donation_item_id, list);
    }

    return map;
  }

  private async getUsersById(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) {
      return new Map<string, users>();
    }
    const rows = await this.prisma.users.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  /** Best-effort push notification — a delivery failure must not fail the underlying mutation. */
  private async notifyDonor(donorId: string, title: string, body: string, itemId: string) {
    try {
      await this.notificationsService.notifyUser(donorId, {
        type: 'COMMUNITY',
        title,
        body,
        data: { donationItemId: itemId, screen: 'DONATION_ITEM_DETAIL' },
      });
    } catch (error) {
      this.logger.error(`Failed to notify donor ${donorId} for donation item ${itemId}`, error as Error);
    }
  }

  async findOrThrow(
    itemId: string,
    options?: { donorId?: string; verifiedOnly?: boolean },
  ): Promise<donation_items> {
    const item = await this.prisma.donation_items.findFirst({
      where: {
        id: itemId,
        deleted_at: null,
        ...(options?.donorId ? { donor_id: options.donorId } : {}),
        ...(options?.verifiedOnly ? { verified_at: { not: null } } : {}),
      },
    });

    if (!item) {
      throw new NotFoundException('Donation item not found');
    }

    return item;
  }

  private toPublicImage(image: donation_item_images) {
    return {
      id: image.id,
      url: image.url,
      sortOrder: image.sort_order,
      isPrimary: image.is_primary,
    };
  }

  toPublic(item: donation_items, donor?: users, images: donation_item_images[] = []) {
    return {
      id: item.id,
      donorId: item.donor_id,
      donor: donor
        ? {
            id: donor.id,
            fullName: donor.full_name,
            mobileMasked: donor.mobile ? maskMobile(donor.mobile) : null,
          }
        : null,
      title: item.title,
      description: item.description,
      category: item.category,
      condition: item.condition,
      quantity: item.quantity,
      status: item.status,
      pickupCity: item.pickup_city,
      pickupState: item.pickup_state,
      pickupAddress: item.pickup_address,
      isPickupOnly: item.is_pickup_only,
      adminNote: item.admin_note,
      isVerified: !!item.verified_at,
      verifiedById: item.verified_by_id,
      verifiedAt: item.verified_at,
      tags: item.tags,
      images: images.map((image) => this.toPublicImage(image)),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }
}
