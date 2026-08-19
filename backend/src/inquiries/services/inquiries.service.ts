import { Injectable, NotFoundException } from '@nestjs/common';
import { inquiries, inquiry_status, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInquiryDto, ListInquiriesQueryDto, UpdateInquiryDto } from '../dto/inquiry.dto';

@Injectable()
export class InquiriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInquiryDto, userId?: string) {
    const inquiry = await this.prisma.inquiries.create({
      data: {
        user_id: userId,
        name: dto.name,
        email: dto.email,
        mobile: dto.mobile,
        subject: dto.subject,
        message: dto.message,
      },
    });

    return this.toPublic(inquiry);
  }

  async list(query: ListInquiriesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.inquiriesWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { subject: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.inquiries.count({ where }),
      this.prisma.inquiries.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
    ]);

    return {
      items: rows.map((row) => this.toPublic(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async get(inquiryId: string) {
    const inquiry = await this.findOrThrow(inquiryId);
    return this.toPublic(inquiry);
  }

  async update(inquiryId: string, dto: UpdateInquiryDto, adminId: string) {
    await this.findOrThrow(inquiryId);

    const updated = await this.prisma.inquiries.update({
      where: { id: inquiryId },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.adminNote !== undefined && { admin_note: dto.adminNote }),
        ...(dto.status === inquiry_status.RESOLVED && {
          resolved_by_id: adminId,
          resolved_at: new Date(),
        }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async remove(inquiryId: string) {
    await this.findOrThrow(inquiryId);
    await this.prisma.inquiries.delete({ where: { id: inquiryId } });
  }

  private async findOrThrow(inquiryId: string): Promise<inquiries> {
    const inquiry = await this.prisma.inquiries.findUnique({ where: { id: inquiryId } });
    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }
    return inquiry;
  }

  private toPublic(inquiry: inquiries) {
    return {
      id: inquiry.id,
      userId: inquiry.user_id,
      name: inquiry.name,
      email: inquiry.email,
      mobile: inquiry.mobile,
      subject: inquiry.subject,
      message: inquiry.message,
      status: inquiry.status,
      adminNote: inquiry.admin_note,
      resolvedById: inquiry.resolved_by_id,
      resolvedAt: inquiry.resolved_at,
      createdAt: inquiry.created_at,
      updatedAt: inquiry.updated_at,
    };
  }
}
