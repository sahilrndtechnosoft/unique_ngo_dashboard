import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  cart_items,
  carts,
  product_images,
  product_status,
  product_variants,
  products,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    return this.toPublicCart(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const cart = await this.getOrCreateCart(userId);
    const quantity = dto.quantity ?? 1;

    const product = await this.prisma.products.findFirst({
      where: { id: dto.productId, deleted_at: null, status: product_status.ACTIVE },
    });
    if (!product) {
      throw new NotFoundException('Product not found or unavailable');
    }

    let variant: product_variants | null = null;
    if (dto.variantId) {
      variant = await this.prisma.product_variants.findFirst({
        where: { id: dto.variantId, product_id: product.id, is_active: true },
      });
      if (!variant) {
        throw new NotFoundException('Product variant not found');
      }
    }

    const availableStock = variant ? variant.stock_quantity : product.stock_quantity;
    const price = variant ? variant.price : product.price;

    const existing = await this.prisma.cart_items.findFirst({
      where: {
        cart_id: cart.id,
        product_id: product.id,
        variant_id: dto.variantId ?? null,
      },
    });
    const desiredQuantity = (existing?.quantity ?? 0) + quantity;

    if (desiredQuantity > availableStock) {
      throw new BadRequestException(
        `Only ${availableStock} unit(s) of this product are available`,
      );
    }

    if (existing) {
      await this.prisma.cart_items.update({
        where: { id: existing.id },
        data: { quantity: desiredQuantity, price_at_add: price, updated_at: new Date() },
      });
    } else {
      await this.prisma.cart_items.create({
        data: {
          cart_id: cart.id,
          product_id: product.id,
          variant_id: dto.variantId,
          quantity,
          price_at_add: price,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.findItemOrThrow(cart.id, itemId);

    const availableStock = item.variant_id
      ? (
          await this.prisma.product_variants.findUniqueOrThrow({
            where: { id: item.variant_id },
          })
        ).stock_quantity
      : (
          await this.prisma.products.findUniqueOrThrow({
            where: { id: item.product_id },
          })
        ).stock_quantity;

    if (dto.quantity > availableStock) {
      throw new BadRequestException(
        `Only ${availableStock} unit(s) of this product are available`,
      );
    }

    await this.prisma.cart_items.update({
      where: { id: item.id },
      data: { quantity: dto.quantity, updated_at: new Date() },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.findItemOrThrow(cart.id, itemId);
    await this.prisma.cart_items.delete({ where: { id: itemId } });
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cart_items.deleteMany({ where: { cart_id: cart.id } });
    return this.getCart(userId);
  }

  async getOrCreateCart(userId: string): Promise<carts> {
    const existing = await this.prisma.carts.findUnique({ where: { user_id: userId } });
    if (existing) {
      return existing;
    }
    return this.prisma.carts.create({ data: { user_id: userId } });
  }

  private async findItemOrThrow(cartId: string, itemId: string) {
    const item = await this.prisma.cart_items.findFirst({
      where: { id: itemId, cart_id: cartId },
    });
    if (!item) {
      throw new NotFoundException('Cart item not found');
    }
    return item;
  }

  private async toPublicCart(cart: carts) {
    const items = await this.prisma.cart_items.findMany({
      where: { cart_id: cart.id },
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

    const publicItems = items.map((item) =>
      this.toPublicItem(
        item,
        productsById.get(item.product_id),
        item.variant_id ? variantsById.get(item.variant_id) : undefined,
        imagesByProduct.get(item.product_id),
      ),
    );

    const subtotal = publicItems.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );

    return {
      id: cart.id,
      couponCode: cart.coupon_code,
      discountAmount: Number(cart.discount_amount),
      items: publicItems,
      itemCount: publicItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      total: subtotal - Number(cart.discount_amount),
    };
  }

  private toPublicItem(
    item: cart_items,
    product?: products,
    variant?: product_variants,
    image?: product_images,
  ) {
    const currentPrice = variant ? Number(variant.price) : product ? Number(product.price) : 0;
    const availableStock = variant ? variant.stock_quantity : product?.stock_quantity ?? 0;

    return {
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
      priceAtAdd: Number(item.price_at_add),
      currentPrice,
      lineTotal: currentPrice * item.quantity,
      isAvailable: !!product && product.status === product_status.ACTIVE,
      availableStock,
      product: product
        ? {
            id: product.id,
            name: product.name,
            slug: product.slug,
            status: product.status,
            imageUrl: image?.url ?? null,
          }
        : null,
      variant: variant
        ? {
            id: variant.id,
            name: variant.name,
            attributes: variant.attributes,
          }
        : null,
    };
  }

  private async getProductsById(productIds: string[]) {
    const rows = await this.prisma.products.findMany({
      where: { id: { in: productIds } },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async getVariantsById(variantIds: string[]) {
    if (variantIds.length === 0) {
      return new Map<string, product_variants>();
    }
    const rows = await this.prisma.product_variants.findMany({
      where: { id: { in: variantIds } },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async getPrimaryImagesByProduct(productIds: string[]) {
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
