import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  delivery_tracking_events,
  order_items,
  orders,
  product_status,
  shipments,
} from '../../generated/prisma/client';
import { generateSecureToken } from '../common/utils/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { AddressesService } from '../addresses/addresses.service';
import { CheckoutDto, ListOrdersQueryDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly addressesService: AddressesService,
  ) {}

  async checkout(userId: string, dto: CheckoutDto) {
    await this.addressesService.ensureOwnedAddress(userId, dto.shippingAddressId);

    const cart = await this.prisma.carts.findUnique({ where: { user_id: userId } });
    const cartItems = cart
      ? await this.prisma.cart_items.findMany({ where: { cart_id: cart.id } })
      : [];

    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const productIds = [...new Set(cartItems.map((item) => item.product_id))];
    const products = await this.prisma.products.findMany({
      where: { id: { in: productIds } },
    });
    const productsById = new Map(products.map((product) => [product.id, product]));

    const variantIds = cartItems
      .map((item) => item.variant_id)
      .filter((id): id is string => !!id);
    const variants =
      variantIds.length > 0
        ? await this.prisma.product_variants.findMany({
            where: { id: { in: variantIds } },
          })
        : [];
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

    const primaryImages = await this.prisma.product_images.findMany({
      where: { product_id: { in: productIds } },
      orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
    });
    const imageByProduct = new Map<string, string>();
    for (const image of primaryImages) {
      if (!imageByProduct.has(image.product_id)) {
        imageByProduct.set(image.product_id, image.url);
      }
    }

    const itemsBySeller = new Map<string, typeof cartItems>();
    for (const item of cartItems) {
      const product = productsById.get(item.product_id);
      if (!product || product.deleted_at || product.status !== product_status.ACTIVE) {
        throw new BadRequestException(
          `Product in cart is no longer available (${item.product_id})`,
        );
      }
      if (item.variant_id && !variantsById.get(item.variant_id)) {
        throw new BadRequestException('Product variant in cart is no longer available');
      }
      const group = itemsBySeller.get(product.seller_id) ?? [];
      group.push(item);
      itemsBySeller.set(product.seller_id, group);
    }

    const createdOrders = await this.prisma.$transaction(async (tx) => {
      const results: orders[] = [];

      for (const [sellerId, items] of itemsBySeller) {
        let subtotal = new Prisma.Decimal(0);
        let taxAmount = new Prisma.Decimal(0);
        const orderItemsData: Prisma.order_itemsCreateManyInput[] = [];

        for (const item of items) {
          const product = productsById.get(item.product_id)!;
          const variant = item.variant_id ? variantsById.get(item.variant_id) : undefined;
          const unitPrice = variant ? variant.price : product.price;
          const lineSubtotal = unitPrice.mul(item.quantity);
          const lineTax = product.is_taxable
            ? lineSubtotal.mul(product.tax_rate).div(100)
            : new Prisma.Decimal(0);

          subtotal = subtotal.add(lineSubtotal);
          taxAmount = taxAmount.add(lineTax);

          const stockTable = variant ? tx.product_variants : tx.products;
          const stockWhere = variant ? { id: variant.id } : { id: product.id };
          const updateResult = await (stockTable as typeof tx.products).updateMany({
            where: { ...stockWhere, stock_quantity: { gte: item.quantity } },
            data: { stock_quantity: { decrement: item.quantity } },
          });
          if (updateResult.count === 0) {
            throw new BadRequestException(
              `Insufficient stock for "${product.name}"`,
            );
          }

          orderItemsData.push({
            order_id: '',
            product_id: product.id,
            variant_id: variant?.id,
            seller_id: sellerId,
            product_name: product.name,
            variant_name: variant?.name,
            sku: variant?.sku ?? product.sku,
            quantity: item.quantity,
            unit_price: unitPrice,
            tax_rate: product.tax_rate,
            tax_amount: lineTax,
            total_price: lineSubtotal.add(lineTax),
            image_url: imageByProduct.get(product.id),
            is_returnable: product.is_returnable,
            return_days: product.return_days,
          });
        }

        const totalAmount = subtotal.add(taxAmount);

        const order = await tx.orders.create({
          data: {
            order_number: `ORD-${generateSecureToken()}`,
            buyer_id: userId,
            seller_id: sellerId,
            subtotal,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            payment_method: dto.paymentMethod,
            shipping_address_id: dto.shippingAddressId,
            notes: dto.notes,
          },
        });

        await tx.order_items.createMany({
          data: orderItemsData.map((data) => ({ ...data, order_id: order.id })),
        });

        await tx.shipments.create({ data: { order_id: order.id } });

        results.push(order);
      }

      await tx.cart_items.deleteMany({
        where: { id: { in: cartItems.map((item) => item.id) } },
      });

      return results;
    });

    return Promise.all(createdOrders.map((order) => this.getOrder(userId, order.id)));
  }

  async listOrders(userId: string, query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ordersWhereInput = {
      buyer_id: userId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.orders.count({ where }),
      this.prisma.orders.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const orderIds = rows.map((row) => row.id);
    const items = await this.prisma.order_items.findMany({
      where: { order_id: { in: orderIds } },
    });
    const itemsByOrder = new Map<string, order_items[]>();
    for (const item of items) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    }

    return {
      items: rows.map((row) =>
        this.toPublicOrder(row, itemsByOrder.get(row.id) ?? []),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getOrder(userId: string, orderId: string) {
    const order = await this.prisma.orders.findFirst({
      where: { id: orderId, buyer_id: userId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const [items, shipment] = await Promise.all([
      this.prisma.order_items.findMany({ where: { order_id: orderId } }),
      this.prisma.shipments.findUnique({ where: { order_id: orderId } }),
    ]);

    const trackingEvents = shipment
      ? await this.prisma.delivery_tracking_events.findMany({
          where: { shipment_id: shipment.id },
          orderBy: { occurred_at: 'desc' },
        })
      : [];

    return this.toPublicOrder(order, items, shipment, trackingEvents);
  }

  private toPublicOrder(
    order: orders,
    items: order_items[],
    shipment?: shipments | null,
    trackingEvents?: delivery_tracking_events[],
  ) {
    return {
      id: order.id,
      orderNumber: order.order_number,
      sellerId: order.seller_id,
      status: order.status,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discount_amount),
      shippingFee: Number(order.shipping_fee),
      taxAmount: Number(order.tax_amount),
      totalAmount: Number(order.total_amount),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      shippingAddressId: order.shipping_address_id,
      shippingType: order.shipping_type,
      estimatedDelivery: order.estimated_delivery,
      notes: order.notes,
      cancelReason: order.cancel_reason,
      cancelledAt: order.cancelled_at,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item.product_name,
        variantName: item.variant_name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        taxAmount: Number(item.tax_amount),
        totalPrice: Number(item.total_price),
        imageUrl: item.image_url,
        isReturnable: item.is_returnable,
        returnDays: item.return_days,
      })),
      tracking: shipment
        ? {
            trackingNumber: shipment.tracking_number,
            carrier: shipment.carrier,
            trackingUrl: shipment.tracking_url,
            status: shipment.status,
            shippedAt: shipment.shipped_at,
            deliveredAt: shipment.delivered_at,
            estimatedDate: shipment.estimated_date,
            events: (trackingEvents ?? []).map((event) => ({
              status: event.status,
              location: event.location,
              description: event.description,
              occurredAt: event.occurred_at,
            })),
          }
        : null,
    };
  }
}
