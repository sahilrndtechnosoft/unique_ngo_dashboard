import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  order_items,
  order_status,
  orders,
  payment_status,
  seller_profiles,
  user_addresses,
  users,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAdminOrdersQueryDto, UpdateOrderStatusDto } from '../dto/order.dto';

const allowedOrderTransitions: Record<order_status, readonly order_status[]> = {
  [order_status.PENDING]: [order_status.CONFIRMED, order_status.PROCESSING, order_status.CANCELLED],
  [order_status.CONFIRMED]: [order_status.PROCESSING, order_status.CANCELLED],
  [order_status.PROCESSING]: [order_status.SHIPPED, order_status.CANCELLED],
  [order_status.SHIPPED]: [order_status.OUT_FOR_DELIVERY, order_status.DELIVERED, order_status.RETURNED],
  [order_status.OUT_FOR_DELIVERY]: [order_status.DELIVERED, order_status.RETURNED],
  [order_status.DELIVERED]: [order_status.RETURNED, order_status.REFUNDED],
  [order_status.CANCELLED]: [order_status.REFUNDED],
  [order_status.RETURNED]: [order_status.REFUNDED],
  [order_status.REFUNDED]: [],
};

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(query: ListAdminOrdersQueryDto, options?: { sellerId?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    let matchingOrderIdsForProduct: string[] | undefined;
    if (query.productId) {
      const items = await this.prisma.order_items.findMany({
        where: { product_id: query.productId },
        select: { order_id: true },
      });
      matchingOrderIdsForProduct = [...new Set(items.map((item) => item.order_id))];
    }

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
      ...(options?.sellerId ? { seller_id: options.sellerId } : {}),
      ...(query.sellerId && !options?.sellerId ? { seller_id: query.sellerId } : {}),
      ...(query.buyerId ? { buyer_id: query.buyerId } : {}),
      ...(query.productId ? { id: { in: matchingOrderIdsForProduct } } : {}),
      ...(query.search
        ? {
            OR: [
              { order_number: { contains: query.search, mode: 'insensitive' } },
              { buyer_id: { in: matchingBuyerIds } },
              { buyer_name: { contains: query.search, mode: 'insensitive' } },
              { buyer_email: { contains: query.search, mode: 'insensitive' } },
              { buyer_mobile: { contains: query.search, mode: 'insensitive' } },
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
      this.getUsersById(rows.flatMap((row) => row.buyer_id ? [row.buyer_id] : [])),
      this.getSellersById(rows.flatMap((row) => row.seller_id ? [row.seller_id] : [])),
    ]);

    return {
      items: rows.map((row) =>
        this.toPublicOrder(row, {
          itemCount: itemCounts.get(row.id) ?? 0,
          buyer: row.buyer_id ? buyersById.get(row.buyer_id) : undefined,
          seller: row.seller_id ? sellersById.get(row.seller_id) : undefined,
        }),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getOrder(orderId: string, sellerId?: string) {
    const order = await this.findOrderOrThrow(orderId, sellerId);

    const [items, buyer, seller, address, shipment] = await Promise.all([
      this.prisma.order_items.findMany({ where: { order_id: orderId } }),
      order.buyer_id
        ? this.prisma.users.findUnique({ where: { id: order.buyer_id } })
        : null,
      order.seller_id
        ? this.prisma.seller_profiles.findUnique({ where: { id: order.seller_id } })
        : null,
      order.shipping_address_id
        ? this.prisma.user_addresses.findUnique({ where: { id: order.shipping_address_id } })
        : null,
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
      reconciliationIssues: [
        ...(items.some((item) => (item.seller_id || order.seller_id) &&
          (item.commission_rate === null || item.commission_amount === null || item.seller_payout === null))
          ? ['Historical item commission or payout snapshots are missing. Verify the original sale records before settling payouts.'] : []),
        ...(order.buyer_id && !buyer ? ['The linked customer record is missing.'] : []),
        ...(order.seller_id && !seller ? ['The linked seller record is missing.'] : []),
        ...(order.shipping_address_id && !address ? ['The linked delivery address is missing; check the saved order address before fulfillment.'] : []),
      ],
      shippingAddress: order.shipping_address_snapshot ?? (address ? this.toPublicAddress(address) : null),
      tracking: shipment
        ? {
            trackingNumber: shipment.tracking_number,
            carrier: shipment.carrier,
            trackingUrl: shipment.tracking_url,
            status: shipment.status,
            provider: shipment.provider,
            providerOrderId: shipment.provider_order_id,
            providerShipmentId: shipment.provider_shipment_id,
            labelUrl: shipment.label_url,
            manifestUrl: shipment.manifest_url,
            pickupScheduledAt: shipment.pickup_scheduled_at,
            shipmentError: shipment.error_message,
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

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto, adminId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === dto.status) return;
      const pickupDelivery = order.shipping_type === 'PICKUP' &&
        order.status === order_status.PROCESSING && dto.status === order_status.DELIVERED;
      if (!allowedOrderTransitions[order.status].includes(dto.status) && !pickupDelivery) {
        throw new ConflictException(`Cannot move an order from ${order.status} to ${dto.status}`);
      }

      const shipment = await tx.shipments.findUnique({ where: { order_id: orderId } });
      if (dto.status === order_status.SHIPPED && order.shipping_type === 'PICKUP') {
        throw new ConflictException('Mark a counter pickup as delivered instead of shipped');
      }
      if (dto.status === order_status.SHIPPED &&
        (shipment?.provider !== 'SHIPROCKET' || !shipment.tracking_number)) {
        throw new ConflictException('Create the carrier shipment and assign its AWB before marking the order shipped');
      }
      if (
        dto.status === order_status.DELIVERED &&
        order.shipping_type !== 'PICKUP' &&
        shipment?.provider === 'SHIPROCKET' &&
        shipment.status.toUpperCase().replaceAll(' ', '_') !== 'DELIVERED'
      ) {
        throw new ConflictException('Wait for Shiprocket to confirm delivery before marking this order delivered');
      }
      if (
        dto.status === order_status.CANCELLED &&
        shipment?.provider === 'SHIPROCKET' &&
        !['PENDING', 'FAILED', 'CANCELLED'].includes(shipment.status)
      ) {
        throw new ConflictException('Cancel the active Shiprocket shipment before cancelling this order');
      }

      const changed = await tx.orders.updateMany({
        where: { id: orderId, status: order.status },
        data: {
          status: dto.status,
          ...(dto.status === order_status.REFUNDED
            ? { payment_status: payment_status.REFUNDED }
            : dto.status === order_status.CANCELLED && order.payment_status === payment_status.PENDING
              ? { payment_status: payment_status.CANCELLED }
              : {}),
          updated_at: new Date(),
          ...(dto.status === order_status.CANCELLED
            ? { cancelled_at: new Date(), cancelled_by_id: adminId, cancel_reason: dto.note }
            : {}),
        },
      });
      if (!changed.count) throw new ConflictException('Order status changed; reload and try again');

      if (dto.status === order_status.CANCELLED) {
        const items = await tx.order_items.findMany({ where: { order_id: orderId } });
        for (const item of items) {
          if (item.variant_id) {
            await tx.product_variants.update({
              where: { id: item.variant_id },
              data: { stock_quantity: { increment: item.quantity } },
            });
          } else {
            await tx.products.update({
              where: { id: item.product_id },
              data: { stock_quantity: { increment: item.quantity } },
            });
          }
        }
        await tx.product_inventory_logs.createMany({
          data: items.map((item) => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            change: item.quantity,
            reason: 'ORDER_CANCELLED',
            reference_type: 'ORDER',
            reference_id: orderId,
            performed_by_id: adminId,
            note: dto.note,
          })),
        });
      }

      if (shipment) {
        const now = new Date();
        const shipmentChanged = await tx.shipments.updateMany({
          where: { id: shipment.id, status: shipment.status },
          data: {
            status: dto.status,
            ...(dto.status === order_status.SHIPPED && !shipment.shipped_at ? { shipped_at: now } : {}),
            ...(dto.status === order_status.DELIVERED && !shipment.delivered_at ? { delivered_at: now } : {}),
            updated_at: now,
          },
        });
        if (!shipmentChanged.count) throw new ConflictException('Shipment status changed; reload and try again');
        await tx.delivery_tracking_events.create({
          data: {
            shipment_id: shipment.id,
            status: dto.status,
            location: dto.location,
            description: dto.note,
          },
        });
      }
    });

    return this.getOrder(orderId);
  }

  private async findOrderOrThrow(orderId: string, sellerId?: string) {
    const order = await this.prisma.orders.findFirst({
      where: { id: orderId, ...(sellerId ? { seller_id: sellerId } : {}) },
    });
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
      source: order.source,
      status: order.status,
      buyerId: order.buyer_id,
      buyer: relations.buyer
        ? {
            id: relations.buyer.id,
            fullName: relations.buyer.full_name,
            email: relations.buyer.email,
            mobile: relations.buyer.mobile,
          }
        : order.buyer_name || order.buyer_email || order.buyer_mobile
          ? {
              id: null,
              fullName: order.buyer_name,
              email: order.buyer_email,
              mobile: order.buyer_mobile,
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
      commissionRate: item.commission_rate === null ? null : Number(item.commission_rate),
      commissionAmount: item.commission_amount === null ? null : Number(item.commission_amount),
      sellerPayout: item.seller_payout === null ? null : Number(item.seller_payout),
      taxAmount: Number(item.tax_amount),
      discountAmount: Number(item.discount_amount),
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
