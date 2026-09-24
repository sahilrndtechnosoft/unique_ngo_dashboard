import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  delivery_tracking_events,
  order_status,
  order_items,
  orders,
  payment_status,
  product_status,
  shipping_type,
  shipments,
} from '../../generated/prisma/client';
import { generateSecureToken } from '../common/utils/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { AddressesService } from '../addresses/addresses.service';
import { CouponsService } from '../coupons/services/coupons.service';
import { allocateAmountByLine, allocateDiscountByLine, calculateLineCommission, calculateLineTax, calculateSellerPayout } from './commission';
import { assertCashOnDeliveryAllowed } from './order-validation';
import { CheckoutDto, ListOrdersQueryDto } from './dto/order.dto';
import { CreateAdminSaleDto } from '../admin/dto/order.dto';
import { calculateProductCouponDiscount, productCouponEligibilityError } from '../coupons/coupon-validation';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly addressesService: AddressesService,
    private readonly couponsService: CouponsService,
  ) {}

  async createAdminSale(dto: CreateAdminSaleDto, adminId: string) {
    const pickup = dto.shippingType === shipping_type.PICKUP;
    const shippingFee = new Prisma.Decimal(dto.shippingFee ?? 0);
    if (shippingFee.lessThan(0)) throw new BadRequestException('Shipping fee cannot be negative');
    if (pickup && !shippingFee.isZero()) throw new BadRequestException('Counter pickup orders cannot include a delivery charge');
    if (!pickup && !dto.shippingAddress) {
      throw new BadRequestException('A shipping address is required for delivery sales');
    }
    if (dto.buyerId) {
      const buyer = await this.prisma.users.findFirst({
        where: { id: dto.buyerId, deleted_at: null },
        select: { id: true },
      });
      if (!buyer) throw new NotFoundException('Customer not found');
    }
    if (dto.items.length === 0) throw new BadRequestException('Sale must include at least one item');

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const variantIds = [...new Set(dto.items.flatMap((item) => item.variantId ? [item.variantId] : []))];
    const [products, variants, images] = await Promise.all([
      this.prisma.products.findMany({
        where: { id: { in: productIds }, deleted_at: null, status: product_status.ACTIVE },
      }),
      variantIds.length
        ? this.prisma.product_variants.findMany({ where: { id: { in: variantIds } } })
        : Promise.resolve([]),
      this.prisma.product_images.findMany({
        where: { product_id: { in: productIds } },
        orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
      }),
    ]);
    const productsById = new Map(products.map((product) => [product.id, product]));
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are not available for sale');
    }
    assertCashOnDeliveryAllowed(dto.paymentMethod, products);
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
    const imageByProduct = new Map<string, string>();
    for (const image of images) {
      if (!imageByProduct.has(image.product_id)) imageByProduct.set(image.product_id, image.url);
    }

    const categories = await this.prisma.product_categories.findMany({
      where: { id: { in: [...new Set(products.map((product) => product.category_id))] } },
    });
    const sellers = await this.prisma.seller_profiles.findMany({
      where: { id: { in: [...new Set(products.flatMap((product) => product.seller_id ? [product.seller_id] : []))] } },
    });
    const commissionAsOf = new Date();
    const defaultCommission = await this.prisma.commission_settings.findFirst({
      where: {
        is_default: true,
        category_id: null,
        seller_id: null,
        effective_from: { lte: commissionAsOf },
        OR: [{ effective_to: null }, { effective_to: { gte: commissionAsOf } }],
      },
      orderBy: [{ effective_from: 'desc' }, { created_at: 'desc' }],
    });
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const sellersById = new Map(sellers.map((seller) => [seller.id, seller]));
    const platformRate = defaultCommission?.rate ?? new Prisma.Decimal(10);
    const itemsBySeller = new Map<string | null, typeof dto.items>();

    for (const item of dto.items) {
      const product = productsById.get(item.productId)!;
      if (product.seller_id && sellersById.get(product.seller_id)?.status !== 'ACTIVE') {
        throw new BadRequestException(`Seller for "${product.name}" is not active`);
      }
      const variant = item.variantId ? variantsById.get(item.variantId) : undefined;
      if (item.variantId && (!variant || variant.product_id !== product.id || !variant.is_active)) {
        throw new BadRequestException(`Variant is not available for "${product.name}"`);
      }
      const group = itemsBySeller.get(product.seller_id) ?? [];
      group.push(item);
      itemsBySeller.set(product.seller_id, group);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const result: orders[] = [];
      const sellerGroups = [...itemsBySeller].sort(([left], [right]) => (left ?? '').localeCompare(right ?? ''));
      const shippingFees = allocateAmountByLine(sellerGroups.map(([sellerId, items]) => ({
        id: sellerId ?? '',
        weight: items.reduce((total, item) => {
          const product = productsById.get(item.productId)!;
          const variant = item.variantId ? variantsById.get(item.variantId) : undefined;
          return total.add((variant?.price ?? product.price).mul(item.quantity));
        }, new Prisma.Decimal(0)),
      })), shippingFee);
      for (const [sellerId, items] of sellerGroups) {
        let subtotal = new Prisma.Decimal(0);
        let taxAmount = new Prisma.Decimal(0);
        let commissionAmount = new Prisma.Decimal(0);
        let sellerPayout = new Prisma.Decimal(0);
        const orderItemsData: Prisma.order_itemsCreateManyInput[] = [];

        for (const item of items) {
          const product = productsById.get(item.productId)!;
          const variant = item.variantId ? variantsById.get(item.variantId) : undefined;
          const unitPrice = variant ? variant.price : product.price;
          const lineSubtotal = unitPrice.mul(item.quantity);
          const commission = calculateLineCommission(sellerId, lineSubtotal, {
            product: product.commission_rate,
            category: categoriesById.get(product.category_id)?.commission_rate,
            seller: sellerId ? sellersById.get(sellerId)?.commission_rate : null,
            platform: platformRate,
          });
          const { rate: commissionRate, amount: lineCommission } = commission;
          const lineTax = calculateLineTax(lineSubtotal, product.is_taxable, product.tax_rate);

          if (sellerId) await this.lockActiveSeller(tx, sellerId, product.name);
          if (variant) await this.lockActiveProduct(tx, product.id, product.name);
          const updatedStock = variant
            ? await tx.product_variants.updateMany({
                where: { id: variant.id, product_id: product.id, is_active: true, price: variant.price, stock_quantity: { gte: item.quantity } },
                data: { stock_quantity: { decrement: item.quantity } },
              })
            : await tx.products.updateMany({
                where: { id: product.id, status: product_status.ACTIVE, deleted_at: null, price: product.price, stock_quantity: { gte: item.quantity } },
                data: { stock_quantity: { decrement: item.quantity } },
              });
          if (!updatedStock.count) throw new ConflictException(`Price or availability changed for "${product.name}"; refresh and try again`);

          const payout = calculateSellerPayout(sellerId, lineSubtotal, lineTax, lineCommission);
          subtotal = subtotal.add(lineSubtotal);
          taxAmount = taxAmount.add(lineTax);
          commissionAmount = commissionAmount.add(lineCommission);
          sellerPayout = sellerPayout.add(payout);
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
            commission_rate: commissionRate,
            commission_amount: lineCommission,
            seller_payout: payout,
            weight_grams: variant?.weight_grams ?? product.weight_grams,
            length_cm: product.length_cm,
            width_cm: product.width_cm,
            height_cm: product.height_cm,
            image_url: imageByProduct.get(product.id),
            is_returnable: product.is_returnable,
            return_days: product.return_days,
          });
        }

        const order = await tx.orders.create({
          data: {
            order_number: `ORD-${generateSecureToken()}`,
            buyer_id: dto.buyerId,
            buyer_name: dto.buyerName,
            buyer_email: dto.buyerEmail,
            buyer_mobile: dto.buyerMobile,
            seller_id: sellerId,
            source: dto.source ?? (pickup ? 'ADMIN_COUNTER' : 'ADMIN_PHONE'),
            created_by_id: adminId,
            shipping_address_snapshot: dto.shippingAddress
              ? { ...dto.shippingAddress, country: dto.shippingAddress.country ?? 'India' }
              : undefined,
            subtotal,
            status: order_status.CONFIRMED,
            tax_amount: taxAmount,
            shipping_fee: shippingFees.get(sellerId ?? '') ?? new Prisma.Decimal(0),
            total_amount: subtotal.add(taxAmount).add(shippingFees.get(sellerId ?? '') ?? new Prisma.Decimal(0)),
            commission_rate: subtotal.isZero()
              ? new Prisma.Decimal(0)
              : commissionAmount.div(subtotal).mul(100).toDecimalPlaces(2),
            commission_amount: commissionAmount,
            seller_payout: sellerPayout,
            payment_method: dto.paymentMethod,
            payment_status: dto.paymentStatus ?? (dto.paymentMethod === 'COD' ? payment_status.PENDING : payment_status.SUCCESS),
            shipping_type: dto.shippingType,
            notes: dto.notes,
          },
        });
        await tx.order_items.createMany({
          data: orderItemsData.map((item) => ({ ...item, order_id: order.id })),
        });
        await tx.product_inventory_logs.createMany({
          data: items.map((item) => ({
            product_id: item.productId,
            variant_id: item.variantId,
            change: -item.quantity,
            reason: 'ADMIN_SALE',
            reference_type: 'ORDER',
            reference_id: order.id,
            performed_by_id: adminId,
          })),
        });
        if (!pickup) await tx.shipments.create({ data: { order_id: order.id } });
        result.push(order);
      }
      return result;
    });

    return created.map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      sellerId: order.seller_id,
      totalAmount: Number(order.total_amount),
      paymentStatus: order.payment_status,
      status: order.status,
    }));
  }

  async checkout(userId: string, dto: CheckoutDto) {
    const address = await this.addressesService.ensureOwnedAddress(
      userId,
      dto.shippingAddressId,
    );

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
    assertCashOnDeliveryAllowed(dto.paymentMethod, products);
    const commissionAsOf = new Date();
    const [categories, sellers, defaultCommission] = await Promise.all([
      this.prisma.product_categories.findMany({
        where: {
          id: { in: [...new Set(products.map((product) => product.category_id))] },
        },
      }),
      this.prisma.seller_profiles.findMany({
        where: {
          id: { in: [...new Set(products.flatMap((product) => product.seller_id ? [product.seller_id] : []))] },
        },
      }),
      this.prisma.commission_settings.findFirst({
        where: {
          is_default: true,
          category_id: null,
          seller_id: null,
          effective_from: { lte: commissionAsOf },
          OR: [
            { effective_to: null },
            { effective_to: { gte: commissionAsOf } },
          ],
        },
        orderBy: [{ effective_from: 'desc' }, { created_at: 'desc' }],
      }),
    ]);
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const sellersById = new Map(sellers.map((seller) => [seller.id, seller]));
    const platformRate = defaultCommission?.rate ?? new Prisma.Decimal(10);

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

    const itemsBySeller = new Map<string | null, typeof cartItems>();
    let cartSubtotal = new Prisma.Decimal(0);
    for (const item of cartItems) {
      const product = productsById.get(item.product_id);
      if (!product || product.deleted_at || product.status !== product_status.ACTIVE) {
        throw new BadRequestException(
          `Product in cart is no longer available (${item.product_id})`,
        );
      }
      if (product.seller_id && sellersById.get(product.seller_id)?.status !== 'ACTIVE') {
        throw new BadRequestException(`Product in cart is no longer available (${item.product_id})`);
      }
      const variant = item.variant_id ? variantsById.get(item.variant_id) : undefined;
      if (
        item.variant_id &&
        (!variant || variant.product_id !== product.id || !variant.is_active)
      ) {
        throw new BadRequestException('Product variant in cart is no longer available');
      }
      const lineSubtotal = (variant ? variant.price : product.price).mul(item.quantity);
      cartSubtotal = cartSubtotal.add(lineSubtotal);
      const group = itemsBySeller.get(product.seller_id) ?? [];
      group.push(item);
      itemsBySeller.set(product.seller_id, group);
    }

    const coupon = dto.couponCode
      ? await this.couponsService.validateForOrder(dto.couponCode, userId, cartSubtotal)
      : null;
    const discountByItem = allocateDiscountByLine(cartItems.map((item) => {
      const product = productsById.get(item.product_id)!;
      const variant = item.variant_id ? variantsById.get(item.variant_id) : undefined;
      return {
        id: item.id,
        subtotal: (variant ? variant.price : product.price).mul(item.quantity),
      };
    }), coupon?.discount ?? new Prisma.Decimal(0));

    const createdOrders = await this.prisma.$transaction(async (tx) => {
      const results: orders[] = [];

      const claimedCart = await tx.cart_items.deleteMany({
        where: {
          cart_id: cart!.id,
          OR: cartItems.map((item) => ({
            id: item.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
          })),
        },
      });
      if (claimedCart.count !== cartItems.length) {
        throw new ConflictException('Cart changed while checkout was in progress. Review it and try again.');
      }

      if (coupon) {
        await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${coupon.couponId}::uuid FOR UPDATE`;
        const currentCoupon = await tx.coupons.findUnique({ where: { id: coupon.couponId } });
        const now = new Date();
        if (!currentCoupon || !currentCoupon.is_active) {
          throw new BadRequestException('Coupon is no longer available; please review your cart');
        }
        const eligibilityError = productCouponEligibilityError(currentCoupon, cartSubtotal, now);
        if (eligibilityError) throw new BadRequestException(eligibilityError);
        const userUseCount = await tx.coupon_usages.count({ where: { coupon_id: coupon.couponId, user_id: userId } });
        if (userUseCount >= currentCoupon.per_user_limit) {
          throw new BadRequestException('You have already used this coupon the maximum number of times');
        }
        const currentDiscount = calculateProductCouponDiscount(currentCoupon, cartSubtotal);
        if (!currentDiscount.equals(coupon.discount)) {
          throw new BadRequestException('Coupon changed during checkout; please retry');
        }
      }

      const sellerGroups = [...itemsBySeller].sort(([left], [right]) => (left ?? '').localeCompare(right ?? ''));
      for (const [sellerId, items] of sellerGroups) {
        let subtotal = new Prisma.Decimal(0);
        let discountAmount = new Prisma.Decimal(0);
        let taxAmount = new Prisma.Decimal(0);
        let commissionAmount = new Prisma.Decimal(0);
        let sellerPayout = new Prisma.Decimal(0);
        const orderItemsData: Prisma.order_itemsCreateManyInput[] = [];

        for (const item of items) {
          const product = productsById.get(item.product_id)!;
          const variant = item.variant_id ? variantsById.get(item.variant_id) : undefined;
          const unitPrice = variant ? variant.price : product.price;
          const lineSubtotal = unitPrice.mul(item.quantity);
          const lineDiscount = discountByItem.get(item.id) ?? new Prisma.Decimal(0);
          const discountedSubtotal = lineSubtotal.sub(lineDiscount);
          const commission = calculateLineCommission(sellerId, discountedSubtotal, {
            product: product.commission_rate,
            category: categoriesById.get(product.category_id)?.commission_rate,
            seller: sellerId ? sellersById.get(sellerId)?.commission_rate : null,
            platform: platformRate,
          });
          const { rate: commissionRate, amount: lineCommission } = commission;
          const lineTax = calculateLineTax(discountedSubtotal, product.is_taxable, product.tax_rate);

          subtotal = subtotal.add(lineSubtotal);
          discountAmount = discountAmount.add(lineDiscount);
          taxAmount = taxAmount.add(lineTax);
          commissionAmount = commissionAmount.add(lineCommission);
          const payout = calculateSellerPayout(sellerId, discountedSubtotal, lineTax, lineCommission);
          sellerPayout = sellerPayout.add(payout);

          let updateResult: Prisma.BatchPayload;
          if (sellerId) await this.lockActiveSeller(tx, sellerId, product.name);
          if (variant) {
            await this.lockActiveProduct(tx, product.id, product.name);
            updateResult = await tx.product_variants.updateMany({
              where: { id: variant.id, product_id: product.id, is_active: true, price: variant.price, stock_quantity: { gte: item.quantity } },
              data: { stock_quantity: { decrement: item.quantity } },
            });
          } else {
            updateResult = await tx.products.updateMany({
                where: { id: product.id, status: product_status.ACTIVE, deleted_at: null, price: product.price, stock_quantity: { gte: item.quantity } },
                data: { stock_quantity: { decrement: item.quantity } },
              });
          }
          if (updateResult.count === 0) {
            throw new ConflictException(`Price or availability changed for "${product.name}"; refresh and try again`);
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
            discount_amount: lineDiscount,
            commission_rate: commissionRate,
            commission_amount: lineCommission,
            seller_payout: payout,
            total_price: discountedSubtotal.add(lineTax),
            weight_grams: variant?.weight_grams ?? product.weight_grams,
            length_cm: product.length_cm,
            width_cm: product.width_cm,
            height_cm: product.height_cm,
            image_url: imageByProduct.get(product.id),
            is_returnable: product.is_returnable,
            return_days: product.return_days,
          });
        }

        const sellerDiscount = items.reduce(
          (sum, item) => sum.add(discountByItem.get(item.id) ?? 0),
          new Prisma.Decimal(0),
        );
        const commissionableSubtotal = subtotal.sub(sellerDiscount);
        const totalAmount = commissionableSubtotal.add(taxAmount);

        const order = await tx.orders.create({
          data: {
            order_number: `ORD-${generateSecureToken()}`,
            buyer_id: userId,
            seller_id: sellerId,
            buyer_name: address.full_name,
            buyer_mobile: address.mobile,
            shipping_address_snapshot: {
              fullName: address.full_name,
              mobile: address.mobile,
              addressLine1: address.address_line1,
              addressLine2: address.address_line2,
              city: address.city,
              state: address.state,
              postalCode: address.postal_code,
              country: address.country,
            },
            subtotal,
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            commission_rate: commissionableSubtotal.isZero()
              ? new Prisma.Decimal(0)
              : commissionAmount.div(commissionableSubtotal).mul(100).toDecimalPlaces(2),
            commission_amount: commissionAmount,
            seller_payout: sellerPayout,
            payment_method: dto.paymentMethod,
            shipping_address_id: dto.shippingAddressId,
            coupon_id: coupon?.couponId,
            coupon_discount: sellerDiscount,
            notes: dto.notes,
          },
        });

        await tx.order_items.createMany({
          data: orderItemsData.map((data) => ({ ...data, order_id: order.id })),
        });

        await tx.product_inventory_logs.createMany({
          data: items.map((item) => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            change: -item.quantity,
            reason: 'ORDER_PLACED',
            reference_type: 'ORDER',
            reference_id: order.id,
            performed_by_id: userId,
          })),
        });

        await tx.shipments.create({ data: { order_id: order.id } });

        results.push(order);
      }

      if (coupon && results.length > 0) {
        await tx.coupon_usages.create({
          data: {
            coupon_id: coupon.couponId,
            user_id: userId,
            order_id: results[0].id,
            discount: coupon.discount,
          },
        });
        await tx.coupons.update({
          where: { id: coupon.couponId },
          data: { used_count: { increment: 1 } },
        });
      }

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

  private async lockActiveProduct(tx: Prisma.TransactionClient, productId: string, productName: string) {
    const [product] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM products
      WHERE id = ${productId}::uuid AND status = 'ACTIVE' AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (!product) {
      throw new ConflictException(`Product is no longer available for "${productName}"`);
    }
  }

  private async lockActiveSeller(tx: Prisma.TransactionClient, sellerId: string, productName: string) {
    const [seller] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM seller_profiles
      WHERE id = ${sellerId}::uuid AND status = 'ACTIVE' AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (!seller) {
      throw new ConflictException(`Seller for "${productName}" is no longer active`);
    }
  }
}
