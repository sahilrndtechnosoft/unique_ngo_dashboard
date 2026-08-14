import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  donation_item_status,
  donation_transfers,
  Prisma,
  users,
} from '../../../generated/prisma/client';
import { deleteUploadedFile } from '../../common/utils/image-upload.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminConfirmDonationTransferDto,
  AdminListDonationTransfersQueryDto,
  ConfirmDonationTransferDto,
  ListDonationTransfersQueryDto,
} from '../dto/donation-transfer.dto';

@Injectable()
export class DonationTransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string, query: ListDonationTransfersQueryDto) {
    return this.list(query, { OR: [{ donor_id: userId }, { recipient_id: userId }] });
  }

  async adminList(query: AdminListDonationTransfersQueryDto) {
    return this.list(query, query.donationItemId ? { donation_item_id: query.donationItemId } : {});
  }

  async get(userId: string, transferId: string) {
    const transfer = await this.findOrThrow(transferId);
    if (transfer.donor_id !== userId && transfer.recipient_id !== userId) {
      throw new ForbiddenException('You do not have access to this transfer');
    }
    return this.toPublic(transfer, await this.getPeople(transfer));
  }

  async adminGet(transferId: string) {
    const transfer = await this.findOrThrow(transferId);
    return this.toPublic(transfer, await this.getPeople(transfer));
  }

  async confirm(
    userId: string,
    transferId: string,
    dto: ConfirmDonationTransferDto,
    proofImagePath?: string,
  ) {
    const transfer = await this.findOrThrow(transferId);

    if (transfer.donor_id !== userId && transfer.recipient_id !== userId) {
      throw new ForbiddenException('You do not have access to this transfer');
    }

    if (proofImagePath && transfer.proof_image_url) {
      deleteUploadedFile(transfer.proof_image_url);
    }

    const updated = await this.prisma.donation_transfers.update({
      where: { id: transferId },
      data: {
        ...(transfer.donor_id === userId && { donor_confirmed: true }),
        ...(transfer.recipient_id === userId && { recipient_confirmed: true }),
        ...(dto.transferDate !== undefined && { transfer_date: new Date(dto.transferDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(proofImagePath && { proof_image_url: proofImagePath }),
        updated_at: new Date(),
      },
    });

    if (updated.donor_confirmed && updated.recipient_confirmed) {
      await this.prisma.donation_items.update({
        where: { id: updated.donation_item_id },
        data: { status: donation_item_status.TRANSFERRED, updated_at: new Date() },
      });
    }

    return this.toPublic(updated, await this.getPeople(updated));
  }

  async adminConfirm(transferId: string, dto: AdminConfirmDonationTransferDto) {
    const transfer = await this.findOrThrow(transferId);

    const updated = await this.prisma.donation_transfers.update({
      where: { id: transferId },
      data: {
        admin_confirmed: true,
        ...(dto.transferDate !== undefined && { transfer_date: new Date(dto.transferDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        updated_at: new Date(),
      },
    });

    await this.prisma.donation_items.update({
      where: { id: transfer.donation_item_id },
      data: { status: donation_item_status.TRANSFERRED, updated_at: new Date() },
    });

    return this.toPublic(updated, await this.getPeople(updated));
  }

  private async list(query: ListDonationTransfersQueryDto, where: Prisma.donation_transfersWhereInput) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      this.prisma.donation_transfers.count({ where }),
      this.prisma.donation_transfers.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
    ]);

    const items = await Promise.all(rows.map(async (row) => this.toPublic(row, await this.getPeople(row))));

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  private async getPeople(transfer: donation_transfers) {
    const [donor, recipient] = await Promise.all([
      this.prisma.users.findUnique({ where: { id: transfer.donor_id } }),
      this.prisma.users.findUnique({ where: { id: transfer.recipient_id } }),
    ]);
    return { donor: donor ?? undefined, recipient: recipient ?? undefined };
  }

  private async findOrThrow(transferId: string): Promise<donation_transfers> {
    const transfer = await this.prisma.donation_transfers.findUnique({ where: { id: transferId } });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }
    return transfer;
  }

  private toPublic(transfer: donation_transfers, people: { donor?: users; recipient?: users }) {
    return {
      id: transfer.id,
      donationItemId: transfer.donation_item_id,
      requestId: transfer.request_id,
      donorId: transfer.donor_id,
      donor: people.donor ? { id: people.donor.id, fullName: people.donor.full_name, mobile: people.donor.mobile } : null,
      recipientId: transfer.recipient_id,
      recipient: people.recipient
        ? { id: people.recipient.id, fullName: people.recipient.full_name, mobile: people.recipient.mobile }
        : null,
      quantity: transfer.quantity,
      transferDate: transfer.transfer_date,
      proofImageUrl: transfer.proof_image_url,
      donorConfirmed: transfer.donor_confirmed,
      recipientConfirmed: transfer.recipient_confirmed,
      adminConfirmed: transfer.admin_confirmed,
      notes: transfer.notes,
      createdAt: transfer.created_at,
      updatedAt: transfer.updated_at,
    };
  }
}
