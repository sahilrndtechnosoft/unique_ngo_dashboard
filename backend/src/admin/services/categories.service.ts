import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, product_categories } from '../../../generated/prisma/client';
import { deleteUploadedFile } from '../../common/utils/image-upload.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from '../dto/category.dto';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(query: ListCategoriesQueryDto, activeOnly = false) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.product_categoriesWhereInput = {
      ...(activeOnly || query.isActive === true ? { is_active: true } : {}),
      ...(query.isActive === false ? { is_active: false } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.product_categories.count({ where }),
      this.prisma.product_categories.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      }),
    ]);

    return {
      items: rows.map((row) => this.toPublic(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getCategory(categoryId: string) {
    return this.toPublic(await this.findOrThrow(categoryId));
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = await this.ensureUniqueSlug(slugify(dto.slug ?? dto.name));

    if (dto.parentId) {
      await this.findOrThrow(dto.parentId);
    }

    const category = await this.prisma.product_categories.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        parent_id: dto.parentId,
        commission_rate: dto.commissionRate,
        sort_order: dto.sortOrder ?? 0,
        is_active: dto.isActive ?? true,
        is_featured: dto.isFeatured ?? false,
        meta_title: dto.metaTitle,
        meta_description: dto.metaDescription,
      },
    });

    return this.toPublic(category);
  }

  async updateCategory(categoryId: string, dto: UpdateCategoryDto) {
    await this.findOrThrow(categoryId);

    if (dto.parentId === categoryId) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    if (dto.parentId) {
      await this.findOrThrow(dto.parentId);
    }

    let slug: string | undefined;
    if (dto.slug || dto.name) {
      slug = await this.ensureUniqueSlug(
        slugify(dto.slug ?? dto.name!),
        categoryId,
      );
    }

    const updated = await this.prisma.product_categories.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(slug !== undefined && { slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.parentId !== undefined && { parent_id: dto.parentId }),
        ...(dto.commissionRate !== undefined && {
          commission_rate: dto.commissionRate,
        }),
        ...(dto.sortOrder !== undefined && { sort_order: dto.sortOrder }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        ...(dto.isFeatured !== undefined && { is_featured: dto.isFeatured }),
        ...(dto.metaTitle !== undefined && { meta_title: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && {
          meta_description: dto.metaDescription,
        }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async updateCategoryImage(categoryId: string, imagePath: string) {
    const category = await this.findOrThrow(categoryId);
    deleteUploadedFile(category.image_url);

    const updated = await this.prisma.product_categories.update({
      where: { id: categoryId },
      data: { image_url: imagePath, updated_at: new Date() },
    });

    return this.toPublic(updated);
  }

  async deleteCategory(categoryId: string) {
    const category = await this.findOrThrow(categoryId);

    const [childCount, productCount] = await Promise.all([
      this.prisma.product_categories.count({
        where: { parent_id: categoryId },
      }),
      this.prisma.products.count({
        where: { category_id: categoryId, deleted_at: null },
      }),
    ]);

    if (childCount > 0) {
      throw new BadRequestException(
        'Category has child categories. Move or delete them first.',
      );
    }

    if (productCount > 0) {
      throw new BadRequestException(
        'Category has products. Reassign products before deleting.',
      );
    }

    deleteUploadedFile(category.image_url);
    await this.prisma.product_categories.delete({ where: { id: categoryId } });
  }

  private async findOrThrow(categoryId: string) {
    const category = await this.prisma.product_categories.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string) {
    if (!slug) {
      throw new BadRequestException('Invalid category slug');
    }

    const existing = await this.prisma.product_categories.findFirst({
      where: {
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(`Category slug "${slug}" is already in use`);
    }

    return slug;
  }

  private toPublic(category: product_categories) {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.image_url,
      iconUrl: category.icon_url,
      parentId: category.parent_id,
      commissionRate: category.commission_rate
        ? Number(category.commission_rate)
        : null,
      sortOrder: category.sort_order,
      isActive: category.is_active,
      isFeatured: category.is_featured,
      metaTitle: category.meta_title,
      metaDescription: category.meta_description,
      createdAt: category.created_at,
      updatedAt: category.updated_at,
    };
  }
}
