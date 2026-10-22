import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { partner_stores, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PartnerAdapterFactory } from '../adapters/partner-adapter.factory';
import {
  CreatePartnerStoreDto,
  ListPartnerStoresQueryDto,
  UpdatePartnerStoreDto,
} from '../dto/partner.dto';

@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterFactory: PartnerAdapterFactory,
  ) {}

  async createPartner(dto: CreatePartnerStoreDto) {
    const slug = dto.slug.trim().toLowerCase();
    const existing = await this.prisma.partner_stores.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`A partner store with slug "${slug}" already exists`);
    }

    const partner = await this.prisma.partner_stores.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim(),
        logo_url: dto.logoUrl?.trim(),
        website_url: dto.websiteUrl?.trim(),
        category: dto.category ?? 'FOOD_BEVERAGE',
        adapter_type: dto.adapterType ?? 'MOCK',
        api_endpoint: dto.apiEndpoint?.trim(),
        config: (dto.config as Prisma.InputJsonValue) ?? undefined,
        is_active: dto.isActive ?? true,
      },
    });

    return this.toPublic(partner);
  }

  async listPartners(query: ListPartnerStoresQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.partner_storesWhereInput = {
      ...(query.isActive !== undefined ? { is_active: query.isActive } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.partner_stores.count({ where }),
      this.prisma.partner_stores.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const items = rows.map((r) => this.toPublic(r));
    return {
      items,
      partners: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getPartnerById(id: string) {
    return this.toPublic(await this.findOrThrow(id));
  }

  async getPartnerBySlug(slug: string) {
    const partner = await this.prisma.partner_stores.findUnique({
      where: { slug: slug.toLowerCase() },
    });
    if (!partner) {
      throw new NotFoundException(`Partner store "${slug}" not found`);
    }
    return this.toPublic(partner);
  }

  async updatePartner(id: string, dto: UpdatePartnerStoreDto) {
    await this.findOrThrow(id);

    if (dto.slug) {
      const nextSlug = dto.slug.trim().toLowerCase();
      const conflict = await this.prisma.partner_stores.findFirst({
        where: { slug: nextSlug, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(`Slug "${nextSlug}" is already in use by another partner`);
      }
    }

    const updated = await this.prisma.partner_stores.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.slug !== undefined && { slug: dto.slug.trim().toLowerCase() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() }),
        ...(dto.logoUrl !== undefined && { logo_url: dto.logoUrl?.trim() }),
        ...(dto.websiteUrl !== undefined && { website_url: dto.websiteUrl?.trim() }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.adapterType !== undefined && { adapter_type: dto.adapterType }),
        ...(dto.apiEndpoint !== undefined && { api_endpoint: dto.apiEndpoint?.trim() }),
        ...(dto.config !== undefined && { config: dto.config as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async deletePartner(id: string) {
    await this.findOrThrow(id);

    const [catalogCount, voucherCount] = await Promise.all([
      this.prisma.rewards_catalog_items.count({ where: { partner_store_id: id } }),
      this.prisma.vouchers.count({ where: { partner_store_id: id } }),
    ]);

    if (catalogCount > 0 || voucherCount > 0) {
      throw new BadRequestException(
        'Cannot delete partner store that has associated catalog items or issued vouchers. Please deactivate it instead.',
      );
    }

    await this.prisma.partner_stores.delete({ where: { id } });
  }

  getAdapter(partner: partner_stores) {
    return this.adapterFactory.getAdapter(partner.adapter_type);
  }

  private async findOrThrow(id: string): Promise<partner_stores> {
    const partner = await this.prisma.partner_stores.findUnique({ where: { id } });
    if (!partner) {
      throw new NotFoundException(`Partner store not found`);
    }
    return partner;
  }

  private toPublic(partner: partner_stores) {
    return {
      id: partner.id,
      name: partner.name,
      slug: partner.slug,
      description: partner.description,
      logoUrl: partner.logo_url,
      websiteUrl: partner.website_url,
      category: partner.category,
      adapterType: partner.adapter_type,
      apiEndpoint: partner.api_endpoint,
      config: partner.config,
      isActive: partner.is_active,
      createdAt: partner.created_at,
      updatedAt: partner.updated_at,
    };
  }
}
