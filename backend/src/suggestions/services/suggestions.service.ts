import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, suggestion_status, suggestions } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSuggestionDto, ListSuggestionsQueryDto, UpdateSuggestionDto } from '../dto/suggestion.dto';

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSuggestionDto) {
    const customer = await this.prisma.users.findFirst({ where: { id: userId, deleted_at: null }, select: { full_name: true, email: true, mobile: true } });
    if (!customer) throw new NotFoundException('Customer account not found');
    return this.toPublic(await this.prisma.suggestions.create({
      data: { user_id: userId, customer_name: customer.full_name, customer_email: customer.email, customer_mobile: customer.mobile, category: dto.category.trim(), title: dto.title.trim(), details: dto.details.trim() },
    }));
  }

  async list(query: ListSuggestionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.suggestionsWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { OR: [
        { customer_name: { contains: query.search, mode: 'insensitive' } },
        { customer_email: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        { details: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.suggestions.count({ where }),
      this.prisma.suggestions.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { created_at: 'desc' } }),
    ]);
    return { items: rows.map((row) => this.toPublic(row)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async get(id: string) { return this.toPublic(await this.findOrThrow(id)); }

  async update(id: string, dto: UpdateSuggestionDto, adminId: string) {
    await this.findOrThrow(id);
    return this.toPublic(await this.prisma.suggestions.update({ where: { id }, data: {
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.adminNote !== undefined ? { admin_note: dto.adminNote } : {}),
      ...(dto.status !== undefined ? { reviewed_by_id: adminId, reviewed_at: new Date() } : {}),
      updated_at: new Date(),
    } }));
  }

  async remove(id: string) { await this.findOrThrow(id); await this.prisma.suggestions.delete({ where: { id } }); }

  private async findOrThrow(id: string): Promise<suggestions> {
    const row = await this.prisma.suggestions.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Suggestion not found');
    return row;
  }

  private toPublic(row: suggestions) {
    return { id: row.id, userId: row.user_id, customer: { name: row.customer_name, email: row.customer_email, mobile: row.customer_mobile }, category: row.category, title: row.title, details: row.details, status: row.status, adminNote: row.admin_note, reviewedById: row.reviewed_by_id, reviewedAt: row.reviewed_at, createdAt: row.created_at, updatedAt: row.updated_at };
  }
}
