import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  product_categories,
  product_images,
  product_status,
  products,
  seller_status,
  seller_profiles,
  users,
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    options?: { sellerId?: string; forcedStatus?: product_status },
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
      ...(options?.forcedStatus
        ? { status: options.forcedStatus }
        : query.status
          ? { status: query.status }
          : {}),
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
    const [images, categoriesById, sellersById] = await Promise.all([
      this.prisma.product_images.findMany({
        where: { product_id: { in: productIds } },
        orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
      }),
      this.getCategoriesById(rows.map((row) => row.category_id)),
      this.getSellersById(rows.flatMap((row) => row.seller_id ? [row.seller_id] : [])),
    ]);
    const imagesByProduct = new Map<string, product_images[]>();
    for (const image of images) {
      const list = imagesByProduct.get(image.product_id) ?? [];
      list.push(image);
      imagesByProduct.set(image.product_id, list);
    }

    return {
      items: rows.map((row) =>
        this.toPublic(row, imagesByProduct.get(row.id) ?? [], {
          category: categoriesById.get(row.category_id),
          seller: row.seller_id ? sellersById.get(row.seller_id) : undefined,
        }),
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
    const [images, relations] = await Promise.all([
      this.prisma.product_images.findMany({
        where: { product_id: productId },
        orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
      }),
      this.getRelationsFor(product),
    ]);
    return this.toPublic(product, images, relations);
  }

  async listVariants(productId: string) {
    await this.findProductOrThrow(productId);
    const variants = await this.prisma.product_variants.findMany({
      where: { product_id: productId, is_active: true },
      orderBy: { created_at: 'asc' },
    });
    return variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      price: Number(variant.price),
      stockQuantity: variant.stock_quantity,
    }));
  }

  async getPublicProduct(idOrSlug: string) {
    const isUuid = UUID_REGEX.test(idOrSlug);

    const product = await this.prisma.products.findFirst({
      where: {
        deleted_at: null,
        status: product_status.ACTIVE,
        OR: isUuid ? [{ id: idOrSlug }, { slug: idOrSlug }] : [{ slug: idOrSlug }],
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.seller_id) {
      const seller = await this.prisma.seller_profiles.findFirst({
        where: { id: product.seller_id, status: seller_status.ACTIVE, deleted_at: null },
        select: { id: true },
      });
      if (!seller) throw new NotFoundException('Product not found');
    }

    const [images, relations] = await Promise.all([
      this.prisma.product_images.findMany({
        where: { product_id: product.id },
        orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
      }),
      this.getRelationsFor(product),
    ]);
    return this.toPublic(product, images, relations);
  }

  async getPlatformCommissionRate() {
    const now = new Date();
    const setting = await this.prisma.commission_settings.findFirst({
      where: {
        is_default: true,
        category_id: null,
        seller_id: null,
        effective_from: { lte: now },
        OR: [{ effective_to: null }, { effective_to: { gte: now } }],
      },
      orderBy: [{ effective_from: 'desc' }, { created_at: 'desc' }],
    });
    return { rate: Number(setting?.rate ?? 10), effectiveFrom: setting?.effective_from ?? null };
  }

  async updatePlatformCommissionRate(rate: number, actorId: string) {
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('platform-commission-settings'))`;
      const active = await tx.commission_settings.findMany({
        where: {
          is_default: true,
          category_id: null,
          seller_id: null,
          effective_from: { lte: today },
          OR: [{ effective_to: null }, { effective_to: { gte: today } }],
        },
        orderBy: [{ effective_from: 'desc' }, { created_at: 'desc' }],
      });

      const sameDay = active.find((setting) => setting.effective_from >= today);
      const nextSetting = await tx.commission_settings.findFirst({
        where: {
          is_default: true,
          category_id: null,
          seller_id: null,
          effective_from: { gt: today },
        },
        orderBy: { effective_from: 'asc' },
      });
      const effectiveTo = nextSetting
        ? new Date(nextSetting.effective_from)
        : null;
      effectiveTo?.setUTCDate(effectiveTo.getUTCDate() - 1);
      effectiveTo?.setUTCHours(0, 0, 0, 0);

      for (const setting of active) {
        if (setting.id === sameDay?.id) continue;
        await tx.commission_settings.update({
          where: { id: setting.id },
          data: { effective_to: yesterday, updated_at: new Date() },
        });
      }

      if (sameDay) {
        await tx.commission_settings.update({
          where: { id: sameDay.id },
          data: { rate, effective_from: today, effective_to: effectiveTo, updated_at: new Date() },
        });
      } else {
        await tx.commission_settings.create({
          data: {
            rate,
            is_default: true,
            effective_from: today,
            effective_to: effectiveTo,
            created_by_id: actorId,
          },
        });
      }
    });

    return this.getPlatformCommissionRate();
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
      let seller: seller_profiles | null = null;
      if (adminDto.sellerId) {
        seller = await this.ensureSellerExists(adminDto.sellerId);
      }
      sellerId = adminDto.sellerId;
      isAdminProduct = true;
      status = adminDto.status ?? product_status.ACTIVE;
      if (status === product_status.ACTIVE && seller && seller.status !== seller_status.ACTIVE) {
        throw new BadRequestException('Activate the seller account before activating its products');
      }
    } else {
      if (!sellerId) {
        throw new ForbiddenException('Seller profile not found');
      }
      status = product_status.PENDING_REVIEW;
    }

    const slug = await this.ensureUniqueSlug(slugify(dto.slug ?? dto.name));

    const product = await this.prisma.products.create({
      data: {
        seller_id: sellerId ?? null,
        category_id: dto.categoryId,
        name: dto.name,
        slug,
        description: dto.description,
        short_description: dto.shortDescription,
        brand: dto.brand,
        sku: dto.sku,
        price: dto.price,
        compare_at_price: dto.compareAtPrice,
        commission_rate: isAdminProduct ? (dto as CreateProductDto).commissionRate : undefined,
        weight_grams: dto.weightGrams,
        length_cm: dto.lengthCm,
        width_cm: dto.widthCm,
        height_cm: dto.heightCm,
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

    return this.toPublic(product, [], await this.getRelationsFor(product));
  }

  async updateProduct(
    productId: string,
    dto: UpdateProductDto,
    options: { isAdmin: boolean; sellerProfileId?: string; actorId?: string },
  ) {
    const product = await this.findProductOrThrow(
      productId,
      options.isAdmin ? undefined : options.sellerProfileId,
    );

    if (
      options.isAdmin &&
      product.status === product_status.PENDING_REVIEW &&
      (dto.status === product_status.ACTIVE || dto.status === product_status.REJECTED)
    ) {
      throw new BadRequestException('Use the explicit approve or reject action to complete product review');
    }

    if (options.isAdmin && dto.status === product_status.ACTIVE && product.seller_id) {
      const seller = await this.prisma.seller_profiles.findFirst({
        where: { id: product.seller_id, status: seller_status.ACTIVE, deleted_at: null },
        select: { id: true },
      });
      if (!seller) throw new BadRequestException('Activate the seller account before activating its products');
    }

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
      status = product_status.PENDING_REVIEW;
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
        ...(options.isAdmin && dto.commissionRate !== undefined && {
          commission_rate: dto.commissionRate,
        }),
        ...(dto.stockQuantity !== undefined && {
          stock_quantity: dto.stockQuantity,
        }),
        ...(dto.weightGrams !== undefined && { weight_grams: dto.weightGrams }),
        ...(dto.lengthCm !== undefined && { length_cm: dto.lengthCm }),
        ...(dto.widthCm !== undefined && { width_cm: dto.widthCm }),
        ...(dto.heightCm !== undefined && { height_cm: dto.heightCm }),
        ...(status !== undefined && { status }),
        ...(!options.isAdmin && status === product_status.PENDING_REVIEW && {
          rejection_reason: null,
          verified_by_id: null,
          verified_at: null,
        }),
        ...(options.isAdmin && status === product_status.ACTIVE && product.status !== product_status.ACTIVE && {
          verified_by_id: options.actorId,
          verified_at: new Date(),
          rejection_reason: null,
        }),
        ...(options.isAdmin && status === product_status.PENDING_REVIEW && product.status !== product_status.PENDING_REVIEW && {
          rejection_reason: null,
          verified_by_id: null,
          verified_at: null,
        }),
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
    const [images, relations] = await Promise.all([
      this.prisma.product_images.findMany({
        where: { product_id: productId },
        orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
      }),
      this.getRelationsFor(updated),
    ]);

    return this.toPublic(updated, images, relations);
  }

  async approveProduct(productId: string, actorId: string) {
    const product = await this.findProductOrThrow(productId);

    if (product.status !== product_status.PENDING_REVIEW) {
      throw new BadRequestException(
        'Only products in PENDING_REVIEW can be approved',
      );
    }
    if (product.seller_id) {
      const seller = await this.prisma.seller_profiles.findFirst({
        where: { id: product.seller_id, status: seller_status.ACTIVE, deleted_at: null },
        select: { id: true },
      });
      if (!seller) throw new BadRequestException('Activate the seller account before approving its products');
    }

    const approved = await this.prisma.products.updateMany({
      where: {
        id: productId,
        status: product_status.PENDING_REVIEW,
        deleted_at: null,
        updated_at: {
          gte: product.updated_at,
          lt: new Date(product.updated_at.getTime() + 1),
        },
      },
      data: {
        status: product_status.ACTIVE,
        verified_by_id: actorId,
        verified_at: new Date(),
        rejection_reason: null,
        updated_at: new Date(),
      },
    });
    if (!approved.count) throw new ConflictException('Product review was already completed');
    const updated = await this.prisma.products.findUniqueOrThrow({ where: { id: productId } });

    const [images, relations] = await Promise.all([
      this.prisma.product_images.findMany({
        where: { product_id: productId },
      }),
      this.getRelationsFor(updated),
    ]);
    return this.toPublic(updated, images, relations);
  }

  async rejectProduct(
    productId: string,
    dto: RejectProductDto,
    actorId: string,
  ) {
    const product = await this.findProductOrThrow(productId);
    if (product.status !== product_status.PENDING_REVIEW) {
      throw new BadRequestException('Only products in PENDING_REVIEW can be rejected');
    }

    const rejected = await this.prisma.products.updateMany({
      where: {
        id: productId,
        status: product_status.PENDING_REVIEW,
        deleted_at: null,
        updated_at: {
          gte: product.updated_at,
          lt: new Date(product.updated_at.getTime() + 1),
        },
      },
      data: {
        status: product_status.REJECTED,
        rejection_reason: dto.reason,
        verified_by_id: actorId,
        verified_at: new Date(),
        updated_at: new Date(),
      },
    });
    if (!rejected.count) throw new ConflictException('Product review was already completed');
    const updated = await this.prisma.products.findUniqueOrThrow({ where: { id: productId } });

    const [images, relations] = await Promise.all([
      this.prisma.product_images.findMany({
        where: { product_id: productId },
      }),
      this.getRelationsFor(updated),
    ]);
    return this.toPublic(updated, images, relations);
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
    const image = await this.prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.product_images.updateMany({
          where: { product_id: productId },
          data: { is_primary: false },
        });
      }

      const count = await tx.product_images.count({
        where: { product_id: productId },
      });
      const created = await tx.product_images.create({
        data: {
          product_id: productId,
          url: imagePath,
          alt_text: options?.altText,
          sort_order: count,
          is_primary: isPrimary || count === 0,
        },
      });

      if (options?.sellerId) {
        const updated = await tx.products.updateMany({
          where: { id: productId, seller_id: options.sellerId, deleted_at: null },
          data: {
            status: product_status.PENDING_REVIEW,
            rejection_reason: null,
            verified_by_id: null,
            verified_at: null,
            updated_at: new Date(),
          },
        });
        if (!updated.count) throw new ConflictException('Product changed while its image was being updated; reload and try again');
      }
      return created;
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

    await this.prisma.$transaction(async (tx) => {
      await tx.product_images.delete({ where: { id: imageId } });

      if (image.is_primary) {
        const next = await tx.product_images.findFirst({
          where: { product_id: productId },
          orderBy: { sort_order: 'asc' },
        });
        if (next) {
          await tx.product_images.update({
            where: { id: next.id },
            data: { is_primary: true },
          });
        }
      }

      if (sellerId) {
        const updated = await tx.products.updateMany({
          where: { id: productId, seller_id: sellerId, deleted_at: null },
          data: {
            status: product_status.PENDING_REVIEW,
            rejection_reason: null,
            verified_by_id: null,
            verified_at: null,
            updated_at: new Date(),
          },
        });
        if (!updated.count) throw new ConflictException('Product changed while its image was being updated; reload and try again');
      }
    });
    deleteUploadedFile(image.url);
  }

  async resolveSellerProfileId(userId: string): Promise<string> {
    const profile = await this.prisma.seller_profiles.findFirst({
      where: { user_id: userId, status: seller_status.ACTIVE, deleted_at: null },
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

  private async ensureSellerExists(sellerId: string): Promise<seller_profiles> {
    const seller = await this.prisma.seller_profiles.findFirst({
      where: { id: sellerId, deleted_at: null },
    });
    if (!seller) {
      throw new BadRequestException('Invalid sellerId');
    }
    return seller;
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

  private async getRelationsFor(product: products) {
    const [category, seller] = await Promise.all([
      this.prisma.product_categories.findUnique({
        where: { id: product.category_id },
      }),
      product.seller_id
        ? this.prisma.seller_profiles.findUnique({
            where: { id: product.seller_id },
          })
        : null,
    ]);
    const user = seller
      ? await this.prisma.users.findUnique({ where: { id: seller.user_id } })
      : null;
    return {
      category: category ? this.toPublicCategory(category) : undefined,
      seller: seller ? this.toPublicSeller(seller, user) : undefined,
    };
  }

  private async getCategoriesById(categoryIds: string[]) {
    const uniqueIds = [...new Set(categoryIds)];
    const categories = await this.prisma.product_categories.findMany({
      where: { id: { in: uniqueIds } },
    });
    return new Map(
      categories.map((category) => [category.id, this.toPublicCategory(category)]),
    );
  }

  private async getSellersById(sellerIds: string[]) {
    const uniqueIds = [...new Set(sellerIds)];
    if (uniqueIds.length === 0) return new Map();
    const sellers = await this.prisma.seller_profiles.findMany({
      where: { id: { in: uniqueIds } },
    });
    const usersById = new Map(
      (
        await this.prisma.users.findMany({
          where: { id: { in: sellers.map((seller) => seller.user_id) } },
        })
      ).map((user) => [user.id, user]),
    );
    return new Map(
      sellers.map((seller) => [
        seller.id,
        this.toPublicSeller(seller, usersById.get(seller.user_id) ?? null),
      ]),
    );
  }

  private toPublicCategory(category: product_categories) {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.image_url,
      iconUrl: category.icon_url,
      parentId: category.parent_id,
    };
  }

  private toPublicSeller(seller: seller_profiles, user?: users | null) {
    return {
      id: seller.id,
      userId: seller.user_id,
      businessName: seller.business_name,
      businessType: seller.business_type,
      description: seller.description,
      logoUrl: seller.logo_url,
      bannerUrl: seller.banner_url,
      status: seller.status,
      isPremium: seller.is_premium,
      rating: Number(seller.rating),
      totalReviews: seller.total_reviews,
      user: user ? this.toPublicUser(user) : null,
    };
  }

  private toPublicUser(user: users) {
    const { password_hash: _passwordHash, ...safeUser } = user;
    return {
      id: safeUser.id,
      role: safeUser.role,
      rbacRoleId: safeUser.rbac_role_id,
      status: safeUser.status,
      fullName: safeUser.full_name,
      email: safeUser.email,
      mobile: safeUser.mobile,
      mobileVerified: safeUser.mobile_verified,
      emailVerified: safeUser.email_verified,
      gender: safeUser.gender,
      dateOfBirth: safeUser.date_of_birth,
      profilePicture: safeUser.profile_image_url,
      bloodGroup: safeUser.blood_group,
      bio: safeUser.bio,
      isAvailableDonor: safeUser.is_available_donor,
      lastDonationDate: safeUser.last_donation_date,
      referralCode: safeUser.referral_code,
      referredById: safeUser.referred_by_id,
      totalDonations: safeUser.total_donations,
      totalPoints: safeUser.total_points,
      createdAt: safeUser.created_at,
      updatedAt: safeUser.updated_at,
      deletedAt: safeUser.deleted_at,
    };
  }

  private toPublic(
    product: products,
    images: product_images[],
    relations?: {
      category?: ReturnType<ProductsService['toPublicCategory']>;
      seller?: ReturnType<ProductsService['toPublicSeller']>;
    },
  ) {
    return {
      id: product.id,
      sellerId: product.seller_id,
      seller: relations?.seller ?? null,
      categoryId: product.category_id,
      category: relations?.category ?? null,
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
      commissionRate:
        product.commission_rate === null ? null : Number(product.commission_rate),
      stockQuantity: product.stock_quantity,
      weightGrams: product.weight_grams,
      lengthCm: product.length_cm === null ? null : Number(product.length_cm),
      widthCm: product.width_cm === null ? null : Number(product.width_cm),
      heightCm: product.height_cm === null ? null : Number(product.height_cm),
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
