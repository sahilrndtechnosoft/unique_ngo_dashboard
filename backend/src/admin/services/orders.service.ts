import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  order_items,
  order_status,
  orders,
  seller_profiles,
  user_addresses,
  users,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAdminOrdersQueryDto, UpdateOrderStatusDto } from '../dto/order.dto';

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(query: ListAdminOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    let matchingBuyerIds: string[] | undefined;
    if (query.search) {
      const buyers = await this.prisma.users.findMany({
        where: {
          deleted_at: null,
          OR: [
            { full_name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { mobile: { contains: query.search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      matchingBuyerIds = buyers.map((buyer) => buyer.id);
    }

    const where: Prisma.ordersWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.sellerId ? { seller_id: query.sellerId } : {}),
      ...(query.search
        ? {
            OR: [
              { order_number: { contains: query.search, mode: 'insensitive' } },
              { buyer_id: { in: matchingBuyerIds } },
            ],
          }
        : {}),
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
    const [itemCounts, buyersById, sellersById] = await Promise.all([
      this.getItemCountsByOrder(orderIds),
      this.getUsersById(rows.map((row) => row.buyer_id)),
      this.getSellersById(rows.map((row) => row.seller_id)),
    ]);

    return {
      items: rows.map((row) =>
        this.toPublicOrder(row, {
          itemCount: itemCounts.get(row.id) ?? 0,
          buyer: buyersById.get(row.buyer_id),
          seller: sellersById.get(row.seller_id),
        }),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getOrder(orderId: string) {
    const order = await this.findOrderOrThrow(orderId);

    const [items, buyer, seller, address, shipment] = await Promise.all([
      this.prisma.order_items.findMany({ where: { order_id: orderId } }),
      this.prisma.users.findUnique({ where: { id: order.buyer_id } }),
      this.prisma.seller_profiles.findUnique({ where: { id: order.seller_id } }),
      this.prisma.user_addresses.findUnique({ where: { id: order.shipping_address_id } }),
      this.prisma.shipments.findUnique({ where: { order_id: orderId } }),
    ]);

    const trackingEvents = shipment
      ? await this.prisma.delivery_tracking_events.findMany({
          where: { shipment_id: shipment.id },
          orderBy: { occurred_at: 'desc' },
        })
      : [];

    return {
      ...this.toPublicOrder(order, {
        itemCount: items.length,
        buyer: buyer ?? undefined,
        seller: seller ?? undefined,
      }),
      items: items.map((item) => this.toPublicItem(item)),
      shippingAddress: address ? this.toPublicAddress(address) : null,
      tracking: shipment
        ? {
            trackingNumber: shipment.tracking_number,
            carrier: shipment.carrier,
            trackingUrl: shipment.tracking_url,
            status: shipment.status,
            shippedAt: shipment.shipped_at,
            deliveredAt: shipment.delivered_at,
            estimatedDate: shipment.estimated_date,
            events: trackingEvents.map((event) => ({
              status: event.status,
              location: event.location,
              description: event.description,
              occurredAt: event.occurred_at,
            })),
          }
        : null,
    };
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto) {
    await this.findOrderOrThrow(orderId);

    await this.prisma.orders.update({
      where: { id: orderId },
      data: { status: dto.status, updated_at: new Date() },
    });

    const shipment = await this.prisma.shipments.findUnique({ where: { order_id: orderId } });
    if (shipment) {
      await this.prisma.shipments.update({
        where: { id: shipment.id },
        data: {
          status: dto.status,
          ...(dto.status === order_status.SHIPPED && !shipment.shipped_at
            ? { shipped_at: new Date() }
            : {}),
          ...(dto.status === order_status.DELIVERED && !shipment.delivered_at
            ? { delivered_at: new Date() }
            : {}),
          updated_at: new Date(),
        },
      });

      await this.prisma.delivery_tracking_events.create({
        data: {
          shipment_id: shipment.id,
          status: dto.status,
          location: dto.location,
          description: dto.note,
        },
      });
    }

    return this.getOrder(orderId);
  }

  private async findOrderOrThrow(orderId: string) {
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private async getItemCountsByOrder(orderIds: string[]) {
    if (orderIds.length === 0) {
      return new Map<string, number>();
    }
    const items = await this.prisma.order_items.findMany({
      where: { order_id: { in: orderIds } },
      select: { order_id: true },
    });
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.order_id, (counts.get(item.order_id) ?? 0) + 1);
    }
    return counts;
  }

  private async getUsersById(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    const rows = await this.prisma.users.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async getSellersById(sellerIds: string[]) {
    const uniqueIds = [...new Set(sellerIds)];
    const rows = await this.prisma.seller_profiles.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toPublicOrder(
    order: orders,
    relations: { itemCount: number; buyer?: users; seller?: seller_profiles },
  ) {
    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      buyerId: order.buyer_id,
      buyer: relations.buyer
        ? {
            id: relations.buyer.id,
            fullName: relations.buyer.full_name,
            email: relations.buyer.email,
            mobile: relations.buyer.mobile,
          }
        : null,
      sellerId: order.seller_id,
      seller: relations.seller
        ? { id: relations.seller.id, businessName: relations.seller.business_name }
        : null,
      itemCount: relations.itemCount,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discount_amount),
      shippingFee: Number(order.shipping_fee),
      taxAmount: Number(order.tax_amount),
      totalAmount: Number(order.total_amount),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      shippingType: order.shipping_type,
      estimatedDelivery: order.estimated_delivery,
      commissionAmount: Number(order.commission_amount),
      sellerPayout: Number(order.seller_payout),
      payoutStatus: order.payout_status,
      notes: order.notes,
      cancelReason: order.cancel_reason,
      cancelledAt: order.cancelled_at,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }

  private toPublicItem(item: order_items) {
    return {
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
    };
  }

  private toPublicAddress(address: user_addresses) {
    return {
      id: address.id,
      label: address.label,
      fullName: address.full_name,
      mobile: address.mobile,
      addressLine1: address.address_line1,
      addressLine2: address.address_line2,
      city: address.city,
      state: address.state,
      postalCode: address.postal_code,
      country: address.country,
    };
  }
}
