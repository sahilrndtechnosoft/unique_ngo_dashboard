import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  product_images,
  product_status,
  products,
} from '../../../generated/prisma/client';
import { deleteUploadedFile } from '../../common/utils/image-upload.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateProductDto,
  CreateSellerProductDto,
  ListProductsQueryDto,
  RejectProductDto,
  UpdateProductDto,
} from '../dto/product.dto';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(
    query: ListProductsQueryDto,
    options?: { sellerId?: string },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.productsWhereInput = {
      deleted_at: null,
      ...(options?.sellerId ? { seller_id: options.sellerId } : {}),
      ...(query.sellerId && !options?.sellerId
        ? { seller_id: query.sellerId }
        : {}),
      ...(query.categoryId ? { category_id: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.products.count({ where }),
      this.prisma.products.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const productIds = rows.map((row) => row.id);
    const images = await this.prisma.product_images.findMany({
      where: { product_id: { in: productIds } },
      orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
    });
    const imagesByProduct = new Map<string, product_images[]>();
    for (const image of images) {
      const list = imagesByProduct.get(image.product_id) ?? [];
      list.push(image);
      imagesByProduct.set(image.product_id, list);
    }

    return {
      items: rows.map((row) =>
        this.toPublic(row, imagesByProduct.get(row.id) ?? []),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getProduct(productId: string, sellerId?: string) {
    const product = await this.findProductOrThrow(productId, sellerId);
    const images = await this.prisma.product_images.findMany({
      where: { product_id: productId },
      orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
    });
    return this.toPublic(product, images);
  }

  async createProduct(
    dto: CreateProductDto | CreateSellerProductDto,
    options: { isAdmin: boolean; sellerProfileId?: string; actorId: string },
  ) {
    await this.ensureCategoryExists(dto.categoryId);

    let sellerId = options.sellerProfileId;
    let isAdminProduct = false;
    let status: product_status = product_status.PENDING_REVIEW;

    if (options.isAdmin) {
      const adminDto = dto as CreateProductDto;
      if (!adminDto.sellerId) {
        throw new BadRequestException(
          'sellerId is required when admin creates a product',
        );
      }
      await this.ensureSellerExists(adminDto.sellerId);
      sellerId = adminDto.sellerId;
      isAdminProduct = true;
      status = adminDto.status ?? product_status.ACTIVE;
    } else {
      if (!sellerId) {
        throw new ForbiddenException('Seller profile not found');
      }
      status = product_status.PENDING_REVIEW;
    }

    const slug = await this.ensureUniqueSlug(slugify(dto.slug ?? dto.name));

    const product = await this.prisma.products.create({
      data: {
        seller_id: sellerId!,
        category_id: dto.categoryId,
        name: dto.name,
        slug,
        description: dto.description,
        short_description: dto.shortDescription,
        brand: dto.brand,
        sku: dto.sku,
        price: dto.price,
        compare_at_price: dto.compareAtPrice,
        stock_quantity: dto.stockQuantity ?? 0,
        status,
        tags: dto.tags ?? [],
        is_featured: dto.isFeatured ?? false,
        is_admin_product: isAdminProduct,
        allow_cod: dto.allowCod ?? true,
        is_returnable: dto.isReturnable ?? true,
        return_days: dto.returnDays ?? 7,
        ...(isAdminProduct && status === product_status.ACTIVE
          ? {
              verified_by_id: options.actorId,
              verified_at: new Date(),
            }
          : {}),
      },
    });

    return this.toPublic(product, []);
  }

  async updateProduct(
    productId: string,
    dto: UpdateProductDto,
    options: { isAdmin: boolean; sellerProfileId?: string },
  ) {
    const product = await this.findProductOrThrow(
      productId,
      options.isAdmin ? undefined : options.sellerProfileId,
    );

    if (dto.categoryId) {
      await this.ensureCategoryExists(dto.categoryId);
    }

    let slug: string | undefined;
    if (dto.slug || dto.name) {
      slug = await this.ensureUniqueSlug(
        slugify(dto.slug ?? dto.name!),
        productId,
      );
    }

    let status = dto.status;
    if (!options.isAdmin) {
      if (dto.resubmitForReview !== false) {
        status = product_status.PENDING_REVIEW;
      } else if (dto.status) {
        throw new ForbiddenException('Sellers cannot set product status directly');
      }
    }

    const updated = await this.prisma.products.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(slug !== undefined && { slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.shortDescription !== undefined && {
          short_description: dto.shortDescription,
        }),
        ...(dto.categoryId !== undefined && { category_id: dto.categoryId }),
        ...(dto.brand !== undefined && { brand: dto.brand }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.compareAtPrice !== undefined && {
          compare_at_price: dto.compareAtPrice,
        }),
        ...(dto.stockQuantity !== undefined && {
          stock_quantity: dto.stockQuantity,
        }),
        ...(status !== undefined && { status }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.isFeatured !== undefined &&
          options.isAdmin && { is_featured: dto.isFeatured }),
        ...(dto.allowCod !== undefined && { allow_cod: dto.allowCod }),
        ...(dto.isReturnable !== undefined && {
          is_returnable: dto.isReturnable,
        }),
        ...(dto.returnDays !== undefined && { return_days: dto.returnDays }),
        updated_at: new Date(),
      },
    });

    const images = await this.prisma.product_images.findMany({
      where: { product_id: productId },
      orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
    });

    return this.toPublic(updated, images);
  }

  async approveProduct(productId: string, actorId: string) {
    const product = await this.findProductOrThrow(productId);

    if (product.status !== product_status.PENDING_REVIEW) {
      throw new BadRequestException(
        'Only products in PENDING_REVIEW can be approved',
      );
    }

    const updated = await this.prisma.products.update({
      where: { id: productId },
      data: {
        status: product_status.ACTIVE,
        verified_by_id: actorId,
        verified_at: new Date(),
        rejection_reason: null,
        updated_at: new Date(),
      },
    });

    const images = await this.prisma.product_images.findMany({
      where: { product_id: productId },
    });
    return this.toPublic(updated, images);
  }

  async rejectProduct(
    productId: string,
    dto: RejectProductDto,
    actorId: string,
  ) {
    await this.findProductOrThrow(productId);

    const updated = await this.prisma.products.update({
      where: { id: productId },
      data: {
        status: product_status.REJECTED,
        rejection_reason: dto.reason,
        verified_by_id: actorId,
        verified_at: new Date(),
        updated_at: new Date(),
      },
    });

    const images = await this.prisma.product_images.findMany({
      where: { product_id: productId },
    });
    return this.toPublic(updated, images);
  }

  async deleteProduct(productId: string, sellerId?: string) {
    const product = await this.findProductOrThrow(productId, sellerId);
    const images = await this.prisma.product_images.findMany({
      where: { product_id: productId },
    });

    for (const image of images) {
      deleteUploadedFile(image.url);
    }

    await this.prisma.$transaction([
      this.prisma.product_images.deleteMany({ where: { product_id: productId } }),
      this.prisma.products.update({
        where: { id: productId },
        data: {
          deleted_at: new Date(),
          status: product_status.ARCHIVED,
          updated_at: new Date(),
        },
      }),
    ]);

    return { id: product.id };
  }

  async addProductImage(
    productId: string,
    imagePath: string,
    options?: { sellerId?: string; isPrimary?: boolean; altText?: string },
  ) {
    await this.findProductOrThrow(productId, options?.sellerId);

    const isPrimary = options?.isPrimary === true;
    if (isPrimary) {
      await this.prisma.product_images.updateMany({
        where: { product_id: productId },
        data: { is_primary: false },
      });
    }

    const count = await this.prisma.product_images.count({
      where: { product_id: productId },
    });

    const image = await this.prisma.product_images.create({
      data: {
        product_id: productId,
        url: imagePath,
        alt_text: options?.altText,
        sort_order: count,
        is_primary: isPrimary || count === 0,
      },
    });

    return this.toPublicImage(image);
  }

  async deleteProductImage(
    productId: string,
    imageId: string,
    sellerId?: string,
  ) {
    await this.findProductOrThrow(productId, sellerId);

    const image = await this.prisma.product_images.findFirst({
      where: { id: imageId, product_id: productId },
    });

    if (!image) {
      throw new NotFoundException('Product image not found');
    }

    deleteUploadedFile(image.url);
    await this.prisma.product_images.delete({ where: { id: imageId } });

    if (image.is_primary) {
      const next = await this.prisma.product_images.findFirst({
        where: { product_id: productId },
        orderBy: { sort_order: 'asc' },
      });
      if (next) {
        await this.prisma.product_images.update({
          where: { id: next.id },
          data: { is_primary: true },
        });
      }
    }
  }

  async resolveSellerProfileId(userId: string): Promise<string> {
    const profile = await this.prisma.seller_profiles.findFirst({
      where: { user_id: userId, deleted_at: null },
    });
    if (!profile) {
      throw new ForbiddenException('Seller profile not found');
    }
    return profile.id;
  }

  private async findProductOrThrow(productId: string, sellerId?: string) {
    const product = await this.prisma.products.findFirst({
      where: {
        id: productId,
        deleted_at: null,
        ...(sellerId ? { seller_id: sellerId } : {}),
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.prisma.product_categories.findUnique({
      where: { id: categoryId },
    });
    if (!category || !category.is_active) {
      throw new BadRequestException('Invalid or inactive category');
    }
  }

  private async ensureSellerExists(sellerId: string) {
    const seller = await this.prisma.seller_profiles.findFirst({
      where: { id: sellerId, deleted_at: null },
    });
    if (!seller) {
      throw new BadRequestException('Invalid sellerId');
    }
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string) {
    if (!slug) {
      throw new BadRequestException('Invalid product slug');
    }

    const existing = await this.prisma.products.findFirst({
      where: {
        slug,
        deleted_at: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(`Product slug "${slug}" is already in use`);
    }

    return slug;
  }

  private toPublic(product: products, images: product_images[]) {
    return {
      id: product.id,
      sellerId: product.seller_id,
      categoryId: product.category_id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.short_description,
      brand: product.brand,
      sku: product.sku,
      status: product.status,
      price: Number(product.price),
      compareAtPrice: product.compare_at_price
        ? Number(product.compare_at_price)
        : null,
      stockQuantity: product.stock_quantity,
      tags: product.tags,
      isFeatured: product.is_featured,
      isAdminProduct: product.is_admin_product,
      allowCod: product.allow_cod,
      isReturnable: product.is_returnable,
      returnDays: product.return_days,
      rejectionReason: product.rejection_reason,
      verifiedAt: product.verified_at,
      images: images.map((image) => this.toPublicImage(image)),
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    };
  }

  private toPublicImage(image: product_images) {
    return {
      id: image.id,
      url: image.url,
      altText: image.alt_text,
      sortOrder: image.sort_order,
      isPrimary: image.is_primary,
      createdAt: image.created_at,
    };
  }
}
