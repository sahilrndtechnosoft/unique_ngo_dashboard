import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  approval_status,
  donation_item_requests,
  donation_item_status,
  donation_items,
  Prisma,
  users,
} from '../../../generated/prisma/client';
import { maskMobile } from '../../common/utils/crypto.util';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminListDonationItemRequestsQueryDto,
  AdminUpdateDonationItemRequestDto,
  CreateDonationItemRequestDto,
  ListDonationItemRequestsQueryDto,
  RespondDonationItemRequestDto,
} from '../dto/donation-item-request.dto';

@Injectable()
export class DonationItemRequestsService {
  private readonly logger = new Logger(DonationItemRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(requesterId: string, dto: CreateDonationItemRequestDto) {
    const item = await this.prisma.donation_items.findFirst({
      where: { id: dto.donationItemId, deleted_at: null, verified_at: { not: null } },
    });

    if (!item) {
      throw new NotFoundException('Donation item not found');
    }

    if (item.donor_id === requesterId) {
      throw new BadRequestException('You cannot request your own donation item');
    }

    if (
      item.status !== donation_item_status.AVAILABLE &&
      item.status !== donation_item_status.REQUESTED
    ) {
      throw new BadRequestException('This item is no longer available for requests');
    }

    const existing = await this.prisma.donation_item_requests.findFirst({
      where: { donation_item_id: item.id, requester_id: requesterId, status: approval_status.PENDING },
    });
    if (existing) {
      throw new BadRequestException('You already have a pending request for this item');
    }

    const request = await this.prisma.donation_item_requests.create({
      data: {
        donation_item_id: item.id,
        requester_id: requesterId,
        quantity_needed: dto.quantityNeeded ?? 1,
        purpose: dto.purpose,
      },
    });

    if (item.status === donation_item_status.AVAILABLE) {
      await this.prisma.donation_items.update({
        where: { id: item.id },
        data: { status: donation_item_status.REQUESTED, updated_at: new Date() },
      });
    }

    await this.notify(item.donor_id, 'New Item Request', `Someone is interested in your donation "${item.title}".`, item.id);

    return this.toPublic(request, item);
  }

  async listMine(requesterId: string, query: ListDonationItemRequestsQueryDto) {
    return this.list(query, { requesterId }, { showDonorContact: true });
  }

  async listForMyItems(donorId: string, query: ListDonationItemRequestsQueryDto) {
    return this.list(query, { donorId }, { showRequesterContact: true });
  }

  async adminList(query: AdminListDonationItemRequestsQueryDto) {
    return this.list(query, { donationItemId: query.donationItemId, requesterId: query.requesterId }, {
      showDonorContact: true,
      showRequesterContact: true,
    });
  }

  async adminGet(requestId: string) {
    const request = await this.findOrThrow(requestId);
    const item = await this.prisma.donation_items.findUnique({ where: { id: request.donation_item_id } });
    return this.toPublic(request, item ?? undefined, { showDonorContact: true, showRequesterContact: true });
  }

  async respond(donorId: string, requestId: string, dto: RespondDonationItemRequestDto) {
    const request = await this.findOrThrow(requestId);
    const item = await this.prisma.donation_items.findFirst({
      where: { id: request.donation_item_id, donor_id: donorId },
    });

    if (!item) {
      throw new ForbiddenException('You do not have access to this request');
    }

    if (request.status !== approval_status.PENDING) {
      throw new BadRequestException('This request has already been responded to');
    }

    return this.applyStatusChange(request, item, dto.status, donorId, dto.adminNote);
  }

  async cancel(requesterId: string, requestId: string) {
    const request = await this.prisma.donation_item_requests.findFirst({
      where: { id: requestId, requester_id: requesterId },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== approval_status.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    const updated = await this.prisma.donation_item_requests.update({
      where: { id: requestId },
      data: { status: approval_status.REJECTED, admin_note: 'Cancelled by requester', updated_at: new Date() },
    });

    await this.revertItemIfNoPendingRequests(request.donation_item_id);

    const item = await this.prisma.donation_items.findUnique({ where: { id: request.donation_item_id } });
    return this.toPublic(updated, item ?? undefined);
  }

  async adminUpdate(requestId: string, dto: AdminUpdateDonationItemRequestDto, adminId: string) {
    const request = await this.findOrThrow(requestId);
    const item = await this.prisma.donation_items.findUnique({ where: { id: request.donation_item_id } });

    if (!item) {
      throw new NotFoundException('Donation item not found');
    }

    if (dto.status !== undefined && dto.status !== request.status) {
      return this.applyStatusChange(request, item, dto.status, adminId, dto.adminNote);
    }

    const updated = await this.prisma.donation_item_requests.update({
      where: { id: requestId },
      data: {
        ...(dto.adminNote !== undefined && { admin_note: dto.adminNote }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated, item, { showDonorContact: true, showRequesterContact: true });
  }

  async adminDelete(requestId: string) {
    const request = await this.findOrThrow(requestId);
    await this.prisma.donation_item_requests.delete({ where: { id: requestId } });
    await this.revertItemIfNoPendingRequests(request.donation_item_id);
  }

  private async applyStatusChange(
    request: donation_item_requests,
    item: donation_items,
    status: approval_status,
    reviewerId: string,
    adminNote?: string,
  ) {
    const updated = await this.prisma.donation_item_requests.update({
      where: { id: request.id },
      data: {
        status,
        admin_note: adminNote,
        reviewed_by_id: reviewerId,
        reviewed_at: new Date(),
        updated_at: new Date(),
      },
    });

    if (status === approval_status.APPROVED) {
      await this.prisma.donation_items.update({
        where: { id: item.id },
        data: { status: donation_item_status.APPROVED, updated_at: new Date() },
      });

      await this.prisma.donation_item_requests.updateMany({
        where: { donation_item_id: item.id, status: approval_status.PENDING, NOT: { id: request.id } },
        data: { status: approval_status.REJECTED, admin_note: 'Item was allocated to another requester', updated_at: new Date() },
      });

      await this.prisma.donation_transfers.create({
        data: {
          donation_item_id: item.id,
          request_id: request.id,
          donor_id: item.donor_id,
          recipient_id: request.requester_id,
          quantity: request.quantity_needed,
        },
      });

      await this.notify(request.requester_id, 'Request Approved', `Your request for "${item.title}" was approved. You can now contact the donor.`, item.id);
    } else {
      await this.revertItemIfNoPendingRequests(item.id);
      await this.notify(request.requester_id, 'Request Update', `Your request for "${item.title}" was not approved.`, item.id);
    }

    const refreshedItem = await this.prisma.donation_items.findUnique({ where: { id: item.id } });
    return this.toPublic(updated, refreshedItem ?? item, { showDonorContact: true, showRequesterContact: true });
  }

  private async revertItemIfNoPendingRequests(itemId: string) {
    const item = await this.prisma.donation_items.findUnique({ where: { id: itemId } });
    if (!item || item.status !== donation_item_status.REQUESTED) {
      return;
    }

    const pendingCount = await this.prisma.donation_item_requests.count({
      where: { donation_item_id: itemId, status: approval_status.PENDING },
    });

    if (pendingCount === 0) {
      await this.prisma.donation_items.update({
        where: { id: itemId },
        data: { status: donation_item_status.AVAILABLE, updated_at: new Date() },
      });
    }
  }

  private async list(
    query: ListDonationItemRequestsQueryDto,
    filter: { requesterId?: string; donorId?: string; donationItemId?: string },
    options: { showDonorContact?: boolean; showRequesterContact?: boolean },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const itemIdsForDonor = filter.donorId
      ? (
          await this.prisma.donation_items.findMany({
            where: { donor_id: filter.donorId },
            select: { id: true },
          })
        ).map((row) => row.id)
      : undefined;

    const where: Prisma.donation_item_requestsWhereInput = {
      ...(filter.requesterId ? { requester_id: filter.requesterId } : {}),
      ...(filter.donationItemId ? { donation_item_id: filter.donationItemId } : {}),
      ...(itemIdsForDonor ? { donation_item_id: { in: itemIdsForDonor } } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.donation_item_requests.count({ where }),
      this.prisma.donation_item_requests.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
    ]);

    const itemsById = await this.getItemsById(rows.map((row) => row.donation_item_id));

    return {
      items: rows.map((row) => this.toPublic(row, itemsById.get(row.donation_item_id), options)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  private async getItemsById(itemIds: string[]) {
    const uniqueIds = [...new Set(itemIds)];
    if (uniqueIds.length === 0) {
      return new Map<string, donation_items>();
    }
    const rows = await this.prisma.donation_items.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async findOrThrow(requestId: string): Promise<donation_item_requests> {
    const request = await this.prisma.donation_item_requests.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }

  /** Best-effort push notification — a delivery failure must not fail the underlying mutation. */
  private async notify(userId: string, title: string, body: string, itemId: string) {
    try {
      await this.notificationsService.notifyUser(userId, {
        type: 'COMMUNITY',
        title,
        body,
        data: { donationItemId: itemId, screen: 'DONATION_ITEM_DETAIL' },
      });
    } catch (error) {
      this.logger.error(`Failed to notify user ${userId} for donation item ${itemId}`, error as Error);
    }
  }

  private async toPublic(
    request: donation_item_requests,
    item?: donation_items,
    options: { showDonorContact?: boolean; showRequesterContact?: boolean } = {},
  ) {
    const [donor, requester] = await Promise.all([
      item && (options.showDonorContact || request.status === approval_status.APPROVED)
        ? this.prisma.users.findUnique({ where: { id: item.donor_id } })
        : Promise.resolve(undefined),
      options.showRequesterContact
        ? this.prisma.users.findUnique({ where: { id: request.requester_id } })
        : Promise.resolve(undefined),
    ]);

    return {
      id: request.id,
      donationItemId: request.donation_item_id,
      item: item ? { id: item.id, title: item.title, status: item.status } : null,
      requesterId: request.requester_id,
      requester: requester
        ? { id: requester.id, fullName: requester.full_name, mobile: requester.mobile }
        : null,
      donorContact: this.buildDonorContact(donor, request.status),
      quantityNeeded: request.quantity_needed,
      purpose: request.purpose,
      status: request.status,
      adminNote: request.admin_note,
      reviewedById: request.reviewed_by_id,
      reviewedAt: request.reviewed_at,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
    };
  }

  private buildDonorContact(donor: users | null | undefined, status: approval_status) {
    if (!donor) {
      return null;
    }

    const revealed = status === approval_status.APPROVED;
    return {
      id: donor.id,
      fullName: donor.full_name,
      mobile: revealed ? donor.mobile : donor.mobile ? maskMobile(donor.mobile) : null,
      isRevealed: revealed,
    };
  }
}
