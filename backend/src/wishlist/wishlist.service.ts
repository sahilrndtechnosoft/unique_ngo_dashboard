import { Injectable, NotFoundException } from '@nestjs/common';
import {
  product_images,
  product_status,
  product_variants,
  products,
  wishlists,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddWishlistItemDto } from './dto/wishlist.dto';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async getWishlist(userId: string) {
    const items = await this.prisma.wishlists.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    const productIds = [...new Set(items.map((item) => item.product_id))];
    const variantIds = [
      ...new Set(items.map((item) => item.variant_id).filter((id): id is string => !!id)),
    ];

    const [productsById, variantsById, imagesByProduct] = await Promise.all([
      this.getProductsById(productIds),
      this.getVariantsById(variantIds),
      this.getPrimaryImagesByProduct(productIds),
    ]);

    return items.map((item) =>
      this.toPublic(
        item,
        productsById.get(item.product_id),
        item.variant_id ? variantsById.get(item.variant_id) : undefined,
        imagesByProduct.get(item.product_id),
      ),
    );
  }

  async addItem(userId: string, dto: AddWishlistItemDto) {
    const product = await this.prisma.products.findFirst({
      where: { id: dto.productId, deleted_at: null },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.variantId) {
      const variant = await this.prisma.product_variants.findFirst({
        where: { id: dto.variantId, product_id: product.id },
      });
      if (!variant) {
        throw new NotFoundException('Product variant not found');
      }
    }

    await this.prisma.wishlists.upsert({
      where: { user_id_product_id: { user_id: userId, product_id: dto.productId } },
      update: { variant_id: dto.variantId },
      create: { user_id: userId, product_id: dto.productId, variant_id: dto.variantId },
    });

    return this.getWishlist(userId);
  }

  async removeItem(userId: string, productId: string) {
    const existing = await this.prisma.wishlists.findUnique({
      where: { user_id_product_id: { user_id: userId, product_id: productId } },
    });
    if (!existing) {
      throw new NotFoundException('Wishlist item not found');
    }

    await this.prisma.wishlists.delete({ where: { id: existing.id } });
    return this.getWishlist(userId);
  }

  private toPublic(
    item: wishlists,
    product?: products,
    variant?: product_variants,
    image?: product_images,
  ) {
    return {
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      createdAt: item.created_at,
      product: product
        ? {
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: Number(product.price),
            status: product.status,
            isAvailable: product.status === product_status.ACTIVE,
            imageUrl: image?.url ?? null,
          }
        : null,
      variant: variant
        ? {
            id: variant.id,
            name: variant.name,
            attributes: variant.attributes,
            price: Number(variant.price),
          }
        : null,
    };
  }

  private async getProductsById(productIds: string[]) {
    if (productIds.length === 0) {
      return new Map<string, products>();
    }
    const rows = await this.prisma.products.findMany({ where: { id: { in: productIds } } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async getVariantsById(variantIds: string[]) {
    if (variantIds.length === 0) {
      return new Map<string, product_variants>();
    }
    const rows = await this.prisma.product_variants.findMany({ where: { id: { in: variantIds } } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async getPrimaryImagesByProduct(productIds: string[]) {
    if (productIds.length === 0) {
      return new Map<string, product_images>();
    }
    const images = await this.prisma.product_images.findMany({
      where: { product_id: { in: productIds } },
      orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
    });
    const map = new Map<string, product_images>();
    for (const image of images) {
      if (!map.has(image.product_id)) {
        map.set(image.product_id, image);
      }
    }
    return map;
  }
}
