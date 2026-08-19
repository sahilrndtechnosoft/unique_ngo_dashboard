import { Injectable, NotFoundException } from '@nestjs/common';
import { pages, page_type } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePageDto, UpdatePageDto } from '../dto/page.dto';

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPages(activeOnly = false, type?: page_type) {
    const rows = await this.prisma.pages.findMany({
      where: {
        deleted_at: null,
        ...(activeOnly ? { is_active: true } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: [{ type: 'asc' }, { sort_order: 'asc' }, { created_at: 'desc' }],
    });

    return rows.map((row) => this.toPublic(row));
  }

  async getPage(pageId: string) {
    const page = await this.findPageOrThrow(pageId);
    return this.toPublic(page);
  }

  async getPageBySlug(slug: string) {
    const page = await this.prisma.pages.findFirst({
      where: { slug, deleted_at: null, is_active: true },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.toPublic(page);
  }

  async createPage(dto: CreatePageDto, updatedById?: string) {
    const slug = await this.generateUniqueSlug(dto.title);

    const page = await this.prisma.pages.create({
      data: {
        slug,
        title: dto.title,
        type: dto.type,
        content: dto.content,
        sort_order: dto.sortOrder ?? 0,
        is_active: dto.isActive ?? true,
        updated_by_id: updatedById,
      },
    });

    return this.toPublic(page);
  }

  async updatePage(pageId: string, dto: UpdatePageDto, updatedById?: string) {
    await this.findPageOrThrow(pageId);

    const updated = await this.prisma.pages.update({
      where: { id: pageId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.sortOrder !== undefined && { sort_order: dto.sortOrder }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        updated_by_id: updatedById,
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async deletePage(pageId: string) {
    await this.findPageOrThrow(pageId);

    await this.prisma.pages.update({
      where: { id: pageId },
      data: {
        deleted_at: new Date(),
        is_active: false,
        updated_at: new Date(),
      },
    });
  }

  private async findPageOrThrow(pageId: string): Promise<pages> {
    const page = await this.prisma.pages.findFirst({
      where: { id: pageId, deleted_at: null },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const base =
      title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'page';

    let slug = base;
    let suffix = 2;
    while (
      await this.prisma.pages.findFirst({ where: { slug, deleted_at: null } })
    ) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private toPublic(page: pages) {
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      type: page.type,
      content: page.content,
      sortOrder: page.sort_order,
      isActive: page.is_active,
      createdAt: page.created_at,
      updatedAt: page.updated_at,
    };
  }
}
