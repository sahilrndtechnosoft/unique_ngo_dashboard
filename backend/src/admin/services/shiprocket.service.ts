import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { order_status, payment_status, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type ShiprocketResponse = Record<string, any>;
class ShiprocketHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
class UnconfirmedShipmentCreateError extends Error {}

const terminalOrderStatuses = new Set<order_status>([
  order_status.CANCELLED,
  order_status.RETURNED,
  order_status.REFUNDED,
]);
const fulfillmentStatusRank: Partial<Record<order_status, number>> = {
  [order_status.PENDING]: 0,
  [order_status.CONFIRMED]: 1,
  [order_status.PROCESSING]: 2,
  [order_status.SHIPPED]: 3,
  [order_status.OUT_FOR_DELIVERY]: 4,
  [order_status.DELIVERED]: 5,
  [order_status.RETURNED]: 6,
  [order_status.REFUNDED]: 7,
  [order_status.CANCELLED]: -1,
};

@Injectable()
export class ShiprocketService {
  private token?: string;
  private tokenExpiresAt = 0;
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = (this.config.get<string>('SHIPROCKET_API_URL') ?? 'https://apiv2.shiprocket.in/v1/external').replace(/\/$/, '');
  }

  async getCourierOptions(orderId: string) {
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.shipping_type === 'PICKUP') throw new BadRequestException('Counter pickup orders do not need a courier');
    if (order.status !== order_status.CONFIRMED && order.status !== order_status.PROCESSING) {
      throw new BadRequestException('Confirm or start processing the order before checking courier availability');
    }
    const [items, address, seller] = await Promise.all([
      this.prisma.order_items.findMany({ where: { order_id: orderId } }),
      order.shipping_address_id
        ? this.prisma.user_addresses.findUnique({ where: { id: order.shipping_address_id } })
        : Promise.resolve(null),
      order.seller_id
        ? this.prisma.seller_profiles.findFirst({ where: { id: order.seller_id, deleted_at: null } })
        : Promise.resolve(null),
    ]);
    if (!items.length) throw new BadRequestException('Order has no shippable items');
    const snapshot = order.shipping_address_snapshot;
    const snapshotAddress = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
      ? snapshot as Record<string, unknown>
      : {};
    const deliveryPostcode = String(snapshotAddress.postalCode ?? snapshotAddress.postal_code ?? address?.postal_code ?? '').trim();
    if (!/^\d{6}$/.test(deliveryPostcode)) throw new BadRequestException('A valid six-digit delivery postal code is required');

    const hasSellerOrigin = Boolean(seller && [
      seller.shiprocket_pickup_location,
      seller.shiprocket_pickup_address,
      seller.shiprocket_pickup_city,
      seller.shiprocket_pickup_state,
      seller.shiprocket_pickup_pin_code,
    ].some((value) => value?.trim()));
    const pickupPostcode = hasSellerOrigin
      ? seller?.shiprocket_pickup_pin_code?.trim()
      : this.config.get<string>('SHIPROCKET_PICKUP_POSTCODE')?.trim();
    if (hasSellerOrigin && (!seller?.shiprocket_pickup_pin_code?.trim() || [
      seller.shiprocket_pickup_location,
      seller.shiprocket_pickup_address,
      seller.shiprocket_pickup_city,
      seller.shiprocket_pickup_state,
    ].some((value) => !value?.trim()))) {
      throw new BadRequestException('Complete the seller Shiprocket pickup origin before checking courier availability');
    }
    if (!pickupPostcode || !/^\d{6}$/.test(pickupPostcode)) {
      throw new ServiceUnavailableException('Set a valid Shiprocket pickup postal code before checking courier availability');
    }

    const packageRows = items.map((item) => ({
      weight: item.weight_grams,
      length: item.length_cm,
      width: item.width_cm,
      height: item.height_cm,
      quantity: item.quantity,
    }));
    if (packageRows.some(({ weight, length, width, height }) => weight == null || length == null || width == null || height == null || Number(weight) <= 0 || Number(length) < 0.5 || Number(width) < 0.5 || Number(height) < 0.5)) {
      throw new BadRequestException('Set packed weight and all three package dimensions on every product before checking couriers');
    }
    const weight = Math.max(0.5, Math.round(packageRows.reduce((sum, row) => sum + Number(row.weight) * row.quantity, 0) / 1000 * 100) / 100);
    const length = Math.max(0.5, ...packageRows.map((row) => Number(row.length)));
    const breadth = Math.max(0.5, ...packageRows.map((row) => Number(row.width)));
    const height = packageRows.reduce((sum, row) => sum + Number(row.height) * row.quantity, 0);
    const params = new URLSearchParams({
      pickup_postcode: pickupPostcode,
      delivery_postcode: deliveryPostcode,
      cod: order.payment_method === 'COD' ? '1' : '0',
      weight: String(weight),
      length: String(length),
      breadth: String(breadth),
      height: String(height),
      declared_value: String(Number(order.total_amount)),
    });
    const response = await this.requestGet(`/courier/serviceability/?${params.toString()}`);
    const data = response.data?.available_courier_companies ?? response.data;
    const couriers = Array.isArray(data) ? data : [];
    return {
      items: couriers.map((courier: ShiprocketResponse) => {
        const rawFreight = [courier.freight_charge, courier.rate, courier.rates, courier.cost]
          .find((value) => value !== '' && value !== null && value !== undefined);
        return {
          courierCompanyId: Number(courier.courier_company_id),
          courierName: String(courier.courier_name ?? 'Courier'),
          freightCharge: Number(rawFreight),
          estimatedDeliveryDays: courier.estimated_delivery_days ? String(courier.estimated_delivery_days) : null,
          estimatedDelivery: courier.etd ? String(courier.etd) : null,
          codAvailable: Boolean(Number(courier.cod)),
          minWeight: courier.min_weight == null ? null : Number(courier.min_weight),
          blocked: Boolean(Number(courier.blocked)),
        };
      }).filter((courier: { courierCompanyId: number; freightCharge: number; blocked: boolean; codAvailable: boolean }) =>
        !courier.blocked && (order.payment_method !== 'COD' || courier.codAvailable) &&
        Number.isSafeInteger(courier.courierCompanyId) && courier.courierCompanyId > 0 &&
        Number.isFinite(courier.freightCharge) && courier.freightCharge >= 0)
        .map(({ blocked: _blocked, ...courier }) => courier),
    };
  }

  async fulfillOrder(orderId: string, courierCompanyId?: number) {
    if (courierCompanyId !== undefined && (!Number.isSafeInteger(courierCompanyId) || courierCompanyId <= 0)) {
      throw new BadRequestException('Choose a valid Shiprocket courier');
    }
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.shipping_type === 'PICKUP') throw new BadRequestException('Counter pickup orders cannot be sent to Shiprocket');
    let shipment = await this.prisma.shipments.findUnique({ where: { order_id: orderId } });
    if (shipment?.status === 'CANCELLED') {
      if (order.status !== order_status.CONFIRMED && order.status !== order_status.PROCESSING) {
        throw new BadRequestException('Confirm or start processing the order before creating a replacement shipment');
      }
      if (order.payment_status === payment_status.FAILED || order.payment_status === payment_status.CANCELLED ||
        order.payment_status === payment_status.REFUNDED ||
        (order.payment_status !== payment_status.SUCCESS && order.payment_method !== 'COD')) {
        throw new BadRequestException('Resolve the payment status before creating a replacement shipment');
      }
      const reset = await this.prisma.shipments.updateMany({
        where: { id: shipment.id, status: 'CANCELLED' },
        data: {
          provider_order_id: null,
          provider_shipment_id: null,
          provider_reference_id: randomUUID().replaceAll('-', '').slice(0, 20),
          tracking_number: null,
          tracking_url: null,
          carrier: null,
          courier_id: null,
          label_url: null,
          manifest_url: null,
          status: 'PROCESSING',
          error_message: null,
          updated_at: new Date(),
        },
      });
      if (!reset.count) throw new ConflictException('Shipment status changed; reload and try again');
      shipment = await this.prisma.shipments.findUniqueOrThrow({ where: { id: shipment.id } });
    }
    if (shipment?.status === 'CREATING') {
      const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
      if (shipment.updated_at && shipment.updated_at <= staleBefore) {
        await this.prisma.shipments.updateMany({
          where: { id: shipment.id, status: 'CREATING', updated_at: { lte: staleBefore } },
          data: {
            status: 'CREATE_UNCERTAIN',
            error_message: 'Shipment creation was interrupted; reconciling with Shiprocket before any retry',
            updated_at: new Date(),
          },
        });
        shipment = await this.prisma.shipments.findUniqueOrThrow({ where: { id: shipment.id } });
      }
      if (shipment.status === 'CREATING') {
        throw new ConflictException('Shipment creation is still in progress; check again shortly');
      }
    }
    if (shipment?.status === 'CREATE_UNCERTAIN') {
      const referenceId = shipment.provider_reference_id ?? order.id.replaceAll('-', '').slice(0, 20);
      const remote = await this.findRemoteOrder(referenceId);
      if (!remote) {
        throw new ConflictException('Shiprocket has not exposed this order yet. Check again before retrying; creation is paused to prevent a duplicate shipment.');
      }
      shipment = await this.persistRemoteOrder(shipment.id, remote);
      return shipment.tracking_number
        ? this.toResult(shipment)
        : this.assignAwb(shipment, courierCompanyId);
    }
    if (shipment?.provider_shipment_id) {
      if (shipment.tracking_number) return this.toResult(shipment);

      if (shipment.provider_order_id) {
        const remote = await this.getRemoteShipment(shipment.provider_order_id, shipment.provider_shipment_id);
        const awb = String(remote?.awb ?? remote?.awb_code ?? '').trim();
        if (awb) {
          shipment = await this.prisma.shipments.update({
            where: { id: shipment.id },
            data: {
              tracking_number: awb,
              tracking_url: `https://shiprocket.co/tracking/${awb}`,
              courier_id: remote?.courier_id != null ? String(remote.courier_id) : shipment.courier_id,
              carrier: remote?.courier || shipment.carrier,
              status: 'AWB_ASSIGNED',
              error_message: null,
              updated_at: new Date(),
            },
          });
          return this.toResult(shipment);
        }
      }

      if (shipment.status === 'AWB_ASSIGNING' || terminalOrderStatuses.has(order.status)) {
        return this.toResult(shipment);
      }
      if (order.status !== order_status.CONFIRMED && order.status !== order_status.PROCESSING) {
        return this.toResult(shipment);
      }
      if (order.payment_status === payment_status.FAILED || order.payment_status === payment_status.CANCELLED ||
        order.payment_status === payment_status.REFUNDED ||
        (order.payment_status !== payment_status.SUCCESS && order.payment_method !== 'COD')) {
        return this.toResult(shipment);
      }
      return this.assignAwb(shipment, courierCompanyId);
    }

    if (order.status !== order_status.CONFIRMED && order.status !== order_status.PROCESSING) {
      throw new BadRequestException('Confirm or start processing the order before shipping');
    }
    if (order.payment_status === payment_status.FAILED || order.payment_status === payment_status.CANCELLED ||
      order.payment_status === payment_status.REFUNDED ||
      (order.payment_status !== payment_status.SUCCESS && order.payment_method !== 'COD')) {
      throw new BadRequestException('Resolve the payment status before creating a shipment');
    }

    if (!shipment) shipment = await this.prisma.shipments.create({ data: { order_id: orderId } });
    const referenceId = shipment.provider_reference_id ?? order.id.replaceAll('-', '').slice(0, 20);

    const claimed = await this.prisma.shipments.updateMany({
      where: { id: shipment.id, provider_shipment_id: null, status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'FAILED'] } },
      data: {
        provider: 'SHIPROCKET',
        provider_reference_id: referenceId,
        status: 'CREATING',
        error_message: null,
        updated_at: new Date(),
        ...(courierCompanyId !== undefined ? { courier_id: String(courierCompanyId) } : {}),
      },
    });
    if (claimed.count === 0) throw new BadRequestException('Shipment creation is already in progress');

    let createRequestAttempted = false;
    let createResponseConfirmed = false;
    try {
      const [items, address, buyer, seller] = await Promise.all([
        this.prisma.order_items.findMany({ where: { order_id: orderId } }),
        order.shipping_address_id
          ? this.prisma.user_addresses.findUnique({ where: { id: order.shipping_address_id } })
          : Promise.resolve(null),
        order.buyer_id
          ? this.prisma.users.findUnique({ where: { id: order.buyer_id } })
          : Promise.resolve(null),
        order.seller_id
          ? this.prisma.seller_profiles.findFirst({ where: { id: order.seller_id, deleted_at: null } })
          : Promise.resolve(null),
      ]);
      const sellerUser = seller
        ? await this.prisma.users.findUnique({ where: { id: seller.user_id } })
        : null;
      if (!items.length) throw new BadRequestException('Order has no shippable items');
      const productIds = [...new Set(items.map((item) => item.product_id))];
      const variantIds = [...new Set(items.flatMap((item) => item.variant_id ? [item.variant_id] : []))];
      const [products, variants] = await Promise.all([
        this.prisma.products.findMany({ where: { id: { in: productIds } } }),
        variantIds.length ? this.prisma.product_variants.findMany({ where: { id: { in: variantIds } } }) : Promise.resolve([]),
      ]);
      const productsById = new Map(products.map((product) => [product.id, product]));
      const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
      const packageItems = items.map((item) => {
        const product = productsById.get(item.product_id);
        const variant = item.variant_id ? variantsById.get(item.variant_id) : undefined;
        return {
          item,
          weight: item.weight_grams ?? variant?.weight_grams ?? product?.weight_grams,
          length: item.length_cm ?? product?.length_cm,
          width: item.width_cm ?? product?.width_cm,
          height: item.height_cm ?? product?.height_cm,
        };
      });
      const snapshot = order.shipping_address_snapshot;
      const snapshotAddress = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
        ? snapshot as Record<string, unknown>
        : {};
      const snapshotKeys: Record<string, string> = {
        full_name: 'fullName',
        address_line1: 'addressLine1',
        address_line2: 'addressLine2',
        postal_code: 'postalCode',
      };
      const field = (key: string, fallback?: string) => {
        const value = snapshotAddress[snapshotKeys[key] ?? key] ?? snapshotAddress[key] ?? address?.[key as keyof typeof address];
        return String(value ?? fallback ?? '').trim();
      };
      const requiredAddress = {
        name: order.buyer_name || field('full_name', buyer?.full_name || 'Customer'),
        phone: order.buyer_mobile || field('mobile', buyer?.mobile ?? undefined),
        line1: field('address_line1'),
        line2: field('address_line2'),
        city: field('city'),
        state: field('state'),
        postalCode: field('postal_code'),
        country: field('country', 'India'),
      };
      if (!requiredAddress.phone || !requiredAddress.line1 || !requiredAddress.city || !requiredAddress.state || !requiredAddress.postalCode) {
        throw new BadRequestException('The order needs a complete delivery address and customer phone before shipping');
      }
      if (!/^\d{6}$/.test(requiredAddress.postalCode)) throw new BadRequestException('A valid six-digit delivery postal code is required');
      const email = order.buyer_email || buyer?.email || this.config.get<string>('SHIPROCKET_FALLBACK_EMAIL');
      if (!email) throw new ServiceUnavailableException('Set an order email or SHIPROCKET_FALLBACK_EMAIL before shipping');
      if (packageItems.some(({ weight, length, width, height }) => weight == null || length == null || width == null || height == null || Number(weight) <= 0 || Number(length) < 0.5 || Number(width) < 0.5 || Number(height) < 0.5)) {
        throw new BadRequestException('Set packed weight and all three package dimensions on every product before shipping');
      }
      const hasSellerOrigin = Boolean(seller && [
        seller.shiprocket_pickup_location,
        seller.shiprocket_pickup_address,
        seller.shiprocket_pickup_city,
        seller.shiprocket_pickup_state,
        seller.shiprocket_pickup_pin_code,
      ].some((value) => value?.trim()));
      let pickupLocation = this.config.get<string>('SHIPROCKET_PICKUP_LOCATION');
      let vendorDetails: Record<string, string> | undefined;
      if (hasSellerOrigin && seller) {
        const requiredOrigin = [
          seller.shiprocket_pickup_location,
          seller.shiprocket_pickup_address,
          seller.shiprocket_pickup_city,
          seller.shiprocket_pickup_state,
          seller.shiprocket_pickup_pin_code,
        ];
        if (requiredOrigin.some((value) => !value?.trim()) || seller.shiprocket_pickup_address!.trim().length < 10) {
          throw new BadRequestException('Complete the seller Shiprocket pickup origin before creating this shipment');
        }
        const pickupAddress2 = seller.shiprocket_pickup_address_2?.trim();
        if (pickupAddress2 && pickupAddress2.length < 10) {
          throw new BadRequestException('Seller Shiprocket pickup address line 2 must be at least 10 characters when provided');
        }
        const originEmail = sellerUser?.email || this.config.get<string>('SHIPROCKET_FALLBACK_EMAIL');
        if (!originEmail || !sellerUser?.mobile) {
          throw new ServiceUnavailableException('A pickup contact email and phone are required for the seller Shiprocket origin');
        }
        pickupLocation = seller.shiprocket_pickup_location!;
        vendorDetails = {
          email: originEmail,
          phone: sellerUser.mobile,
          name: sellerUser.full_name || seller.business_name,
          address: seller.shiprocket_pickup_address!,
          ...(pickupAddress2 ? { address_2: pickupAddress2 } : {}),
          city: seller.shiprocket_pickup_city!,
          state: seller.shiprocket_pickup_state!,
          country: seller.shiprocket_pickup_country || 'India',
          pin_code: seller.shiprocket_pickup_pin_code!,
          pickup_location: pickupLocation,
        };
      }
      if (!pickupLocation) throw new ServiceUnavailableException('SHIPROCKET_PICKUP_LOCATION is not configured');

      const weightGrams = packageItems.reduce((total, row) => total + Number(row.weight) * row.item.quantity, 0);
      const length = Math.max(0.5, ...packageItems.map((row) => Number(row.length)));
      const breadth = Math.max(0.5, ...packageItems.map((row) => Number(row.width)));
      const height = packageItems.reduce((total, row) => total + Number(row.height) * row.item.quantity, 0);
      const shiprocketItems = items.map((item) => {
        const taxRate = Number(item.tax_amount) > 0 ? Number(item.tax_rate) : 0;
        const taxableSubtotal = item.unit_price.mul(item.quantity);
        const taxBeforeDiscount = taxRate > 0
          ? taxableSubtotal.mul(taxRate).div(100).toDecimalPlaces(2)
          : new Prisma.Decimal(0);
        const lineTotal = item.total_price;
        const lineDiscount = taxableSubtotal.add(taxBeforeDiscount).sub(lineTotal);
        if (lineDiscount.lessThan(0)) {
          throw new BadRequestException(`Stored total for "${item.product_name}" exceeds its pre-discount value`);
        }
        return {
          name: item.product_name,
          sku: item.sku || item.product_id,
          units: item.quantity,
          selling_price: item.unit_price.mul(1 + taxRate / 100).toNumber(),
          discount: lineDiscount.div(item.quantity).toNumber(),
          tax: taxRate,
          hsn: '',
          lineTotal,
          lineDiscount,
        };
      });
      const payload: Record<string, unknown> = {
        request_pickup: true,
        print_label: true,
        generate_manifest: true,
        ...(courierCompanyId !== undefined ? { courier_id: courierCompanyId } : {}),
        order_id: referenceId,
        order_date: order.created_at.toISOString().slice(0, 10),
        pickup_location: pickupLocation,
        billing_customer_name: requiredAddress.name,
        billing_address: requiredAddress.line1,
        billing_address_2: requiredAddress.line2,
        billing_city: requiredAddress.city,
        billing_state: requiredAddress.state,
        billing_country: requiredAddress.country,
        billing_pincode: requiredAddress.postalCode,
        billing_email: email,
        billing_phone: requiredAddress.phone,
        shipping_is_billing: true,
        order_items: shiprocketItems.map((item) => ({
          name: item.name,
          sku: item.sku,
          units: item.units,
          selling_price: item.selling_price,
          discount: item.discount,
          tax: item.tax,
          hsn: item.hsn,
        })),
        payment_method: order.payment_method === 'COD' ? 'COD' : 'Prepaid',
        shipping_charges: Number(order.shipping_fee),
        total_discount: shiprocketItems.reduce((total, item) => total.add(item.lineDiscount), new Prisma.Decimal(0)).toNumber(),
        sub_total: shiprocketItems.reduce((total, item) => total.add(item.lineTotal), new Prisma.Decimal(0)).toNumber(),
        weight: Math.max(0.5, Math.round((weightGrams / 1000) * 100) / 100),
        length,
        breadth,
        height,
        ...(vendorDetails ? { vendor_details: vendorDetails } : {}),
      };

      const token = await this.getToken();
      createRequestAttempted = true;
      const response = await this.request('/shipments/create/forward-shipment', payload, token);
      const result = response.payload ?? response;
      if (Number(result.status) === 0 || result.error) {
        throw new Error(String(result.error_message ?? result.message ?? 'Shiprocket rejected the shipment'));
      }
      if (result.shipment_id == null || result.order_id == null) {
        throw new UnconfirmedShipmentCreateError('Shiprocket accepted the create request without returning order and shipment IDs');
      }
      createResponseConfirmed = true;
      shipment = await this.prisma.shipments.update({
        where: { id: shipment.id },
        data: {
          provider: 'SHIPROCKET',
          provider_order_id: result.order_id != null ? String(result.order_id) : referenceId,
          provider_shipment_id: result.shipment_id != null ? String(result.shipment_id) : null,
          tracking_number: result.awb_code || null,
          courier_id: result.courier_company_id != null
            ? String(result.courier_company_id)
            : courierCompanyId !== undefined
              ? String(courierCompanyId)
              : shipment.courier_id,
          carrier: result.courier_name || null,
          tracking_url: result.awb_code ? `https://shiprocket.co/tracking/${result.awb_code}` : null,
          label_url: result.label_url || null,
          manifest_url: result.manifest_url || null,
          status: result.awb_code ? 'AWB_ASSIGNED' : 'CREATED',
          pickup_scheduled_at: result.pickup_scheduled_date ? new Date(result.pickup_scheduled_date) : null,
          error_message: null,
        },
      });
      return shipment.tracking_number
        ? this.toResult(shipment)
        : this.assignAwb(shipment, courierCompanyId);
    } catch (error) {
      if (shipment.provider_shipment_id) throw error;
      const message = error instanceof Error ? error.message : 'Shiprocket request failed';
      if (createRequestAttempted && (createResponseConfirmed || this.hasUncertainCreateOutcome(error))) {
        try {
          const remote = await this.findRemoteOrder(referenceId);
          if (remote) {
            shipment = await this.persistRemoteOrder(shipment.id, remote);
            return shipment.tracking_number
              ? this.toResult(shipment)
              : this.assignAwb(shipment, courierCompanyId);
          }
        } catch (reconciliationError) {
          const reconcileMessage = reconciliationError instanceof Error
            ? reconciliationError.message
            : 'Shiprocket order lookup failed';
          await this.prisma.shipments.update({
            where: { id: shipment.id },
            data: {
              provider: 'SHIPROCKET',
              status: 'CREATE_UNCERTAIN',
              error_message: `${message}; reconciliation failed: ${reconcileMessage}`.slice(0, 1000),
            },
          });
          throw new ServiceUnavailableException('Shiprocket may have created this shipment, but the result could not be confirmed. Check provider status before retrying.');
        }
        await this.prisma.shipments.update({
          where: { id: shipment.id },
          data: {
            provider: 'SHIPROCKET',
            status: 'CREATE_UNCERTAIN',
            error_message: `${message}; waiting for provider order list to reflect the reference ${referenceId}`.slice(0, 1000),
          },
        });
        throw new ServiceUnavailableException('Shiprocket may have created this shipment, but has not confirmed it yet. Check provider status before retrying.');
      }
      await this.prisma.shipments.update({
        where: { id: shipment.id },
        data: { provider: 'SHIPROCKET', status: 'FAILED', error_message: message.slice(0, 1000) },
      });
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(`Shiprocket fulfillment failed: ${message}`);
    }
  }

  private hasUncertainCreateOutcome(error: unknown) {
    return error instanceof TypeError ||
      (error instanceof DOMException && error.name === 'TimeoutError') ||
      error instanceof UnconfirmedShipmentCreateError ||
      (error instanceof ShiprocketHttpError && error.status >= 500);
  }

  private async findRemoteOrder(referenceId: string): Promise<ShiprocketResponse | null> {
    const matches: ShiprocketResponse[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const response = await this.requestGet(`/orders${page > 1 ? `?page=${page}` : ''}`);
      const orders = Array.isArray(response.data) ? response.data : [];
      matches.push(...orders.filter((row: ShiprocketResponse) => String(row.channel_order_id ?? '') === referenceId));
      const reportedPages = Number(response.meta?.pagination?.total_pages);
      totalPages = Number.isSafeInteger(reportedPages) && reportedPages > page ? reportedPages : page;
      page += 1;
    } while (page <= totalPages);
    if (matches.length > 1) {
      throw new ConflictException('Multiple Shiprocket orders use this reference. Resolve the duplicate in Shiprocket before continuing.');
    }
    const match = matches[0];
    if (!match) return null;
    const shipmentRows = Array.isArray(match.shipments)
      ? match.shipments
      : match.shipments && typeof match.shipments === 'object'
        ? [match.shipments]
        : [];
    const providerShipmentId = shipmentRows[0]?.id;
    if (!Number.isSafeInteger(Number(match.id)) || !Number.isSafeInteger(Number(providerShipmentId))) {
      throw new ServiceUnavailableException('Shiprocket order was found, but its order or shipment ID is not available yet. Check again shortly.');
    }
    return { ...match, shipment: shipmentRows[0] };
  }

  private async getRemoteShipment(providerOrderId: string, providerShipmentId: string) {
    const response = await this.requestGet(`/orders/show/${encodeURIComponent(providerOrderId)}`);
    const remoteOrder = response.data ?? response.payload ?? response;
    const shipmentRows = Array.isArray(remoteOrder.shipments)
      ? remoteOrder.shipments
      : remoteOrder.shipments && typeof remoteOrder.shipments === 'object'
        ? [remoteOrder.shipments]
        : [];
    return shipmentRows.find((row: ShiprocketResponse) => String(row.id ?? '') === providerShipmentId)
      ?? (shipmentRows.length === 1 ? shipmentRows[0] : null);
  }

  private async persistRemoteOrder(shipmentId: string, remote: ShiprocketResponse) {
    const providerShipment = remote.shipment as ShiprocketResponse;
    const awb = String(providerShipment.awb ?? remote.awb_code ?? '').trim() || null;
    return this.prisma.shipments.update({
      where: { id: shipmentId },
      data: {
        provider: 'SHIPROCKET',
        provider_order_id: String(remote.id),
        provider_shipment_id: String(providerShipment.id),
        tracking_number: awb,
        ...(Number(providerShipment.courier_id) > 0 ? { courier_id: String(providerShipment.courier_id) } : {}),
        ...(providerShipment.courier ? { carrier: providerShipment.courier } : {}),
        tracking_url: awb ? `https://shiprocket.co/tracking/${awb}` : null,
        status: awb ? 'AWB_ASSIGNED' : 'CREATED',
        error_message: null,
        updated_at: new Date(),
      },
    });
  }

  async refreshTracking(orderId: string) {
    const shipment = await this.prisma.shipments.findUnique({ where: { order_id: orderId } });
    if (!shipment || shipment.provider !== 'SHIPROCKET' || !shipment.provider_shipment_id) {
      throw new BadRequestException('Create the Shiprocket shipment before refreshing tracking');
    }
    const order = await this.prisma.orders.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (terminalOrderStatuses.has(order.status)) {
      throw new BadRequestException('Tracking cannot be refreshed for a cancelled, returned, or refunded order');
    }
    const response = await this.requestGet(`/courier/track/shipment/${encodeURIComponent(shipment.provider_shipment_id)}`);
    const tracking = response.tracking_data ?? response;
    const latest = Array.isArray(tracking.shipment_track) ? tracking.shipment_track[0] : null;
    const awb = String(latest?.awb_code ?? tracking.awb_code ?? shipment.tracking_number ?? '').trim() || null;
    const rawStatus = String(latest?.current_status ?? shipment.status).trim();
    const mappedStatus = this.mapStatus(rawStatus);
    const activities = Array.isArray(tracking.shipment_track_activities) ? tracking.shipment_track_activities : [];
    const remoteLatestMs = activities.reduce((latestMs: number, activity: ShiprocketResponse) => {
      const timestamp = Date.parse(String(activity.date ?? ''));
      return Number.isFinite(timestamp) ? Math.max(latestMs, timestamp) : latestMs;
    }, 0);
    const deliveredAtMs = Date.parse(String(latest?.delivered_date ?? ''));

    await this.prisma.$transaction(async (tx) => {
      const [latestLocalEvent, currentOrder, currentShipment] = await Promise.all([
        tx.delivery_tracking_events.findFirst({
          where: { shipment_id: shipment.id },
          orderBy: [{ occurred_at: 'desc' }, { created_at: 'desc' }],
          select: { occurred_at: true },
        }),
        tx.orders.findUnique({ where: { id: orderId }, select: { status: true } }),
        tx.shipments.findUnique({ where: { id: shipment.id } }),
      ]);
      if (!currentOrder || !currentShipment) throw new NotFoundException('Order shipment not found');
      if (terminalOrderStatuses.has(currentOrder.status)) return;
      const trackingIsCurrent = !latestLocalEvent ||
        (remoteLatestMs > 0 && remoteLatestMs >= latestLocalEvent.occurred_at.getTime());
      const currentShipmentStatus = this.mapStatus(currentShipment.status);
      const statusDoesNotRegress = !mappedStatus || !currentShipmentStatus ||
        (currentShipmentStatus !== order_status.CANCELLED &&
          (fulfillmentStatusRank[mappedStatus] ?? -1) >= (fulfillmentStatusRank[currentShipmentStatus] ?? -1));
      if (activities.length) {
        await tx.delivery_tracking_events.createMany({
          data: activities.flatMap((activity: ShiprocketResponse) => {
            const occurredAtMs = Date.parse(String(activity.date ?? ''));
            if (!Number.isFinite(occurredAtMs)) return [];
            const occurredAt = new Date(occurredAtMs);
            const eventStatus = String(activity['sr-status-label'] ?? activity.status ?? 'UPDATE').slice(0, 100);
            const location = String(activity.location ?? '').slice(0, 255) || null;
            const description = String(activity.activity ?? '').slice(0, 2000) || null;
            const eventKey = createHash('sha256').update(`${shipment.id}:${occurredAt.toISOString()}:${eventStatus}:${location ?? ''}:${description ?? ''}`).digest('hex');
            return [{ shipment_id: shipment.id, status: eventStatus, location, description, provider_event_key: eventKey, occurred_at: occurredAt }];
          }),
          skipDuplicates: true,
        });
      }
      await tx.shipments.update({
        where: { id: shipment.id },
        data: {
          ...(awb ? { tracking_number: awb, tracking_url: tracking.track_url || `https://shiprocket.co/tracking/${awb}` } : {}),
          ...(latest?.courier_company_id != null ? { courier_id: String(latest.courier_company_id) } : {}),
          ...(rawStatus && trackingIsCurrent && statusDoesNotRegress ? { status: rawStatus.slice(0, 100) } : {}),
          ...(mappedStatus === order_status.SHIPPED && !shipment.shipped_at && trackingIsCurrent ? { shipped_at: new Date() } : {}),
          ...(mappedStatus === order_status.DELIVERED && !shipment.delivered_at && trackingIsCurrent ? { delivered_at: Number.isFinite(deliveredAtMs) ? new Date(deliveredAtMs) : new Date() } : {}),
          error_message: null,
          updated_at: new Date(),
        },
      });
      if (trackingIsCurrent && mappedStatus && mappedStatus !== order_status.CANCELLED) {
        if (currentOrder && mappedStatus !== currentOrder.status &&
          (fulfillmentStatusRank[mappedStatus] ?? -1) > (fulfillmentStatusRank[currentOrder.status] ?? Number.MAX_SAFE_INTEGER)) {
          await tx.orders.updateMany({
            where: { id: orderId, status: currentOrder.status },
            data: { status: mappedStatus, updated_at: new Date() },
          });
        }
      }
    });
    return this.toResult(await this.prisma.shipments.findUniqueOrThrow({ where: { id: shipment.id } }));
  }

  private async assignAwb(shipment: Prisma.shipmentsGetPayload<{}>, courierCompanyId?: number) {
    const remoteShipmentId = Number(shipment.provider_shipment_id);
    if (!Number.isSafeInteger(remoteShipmentId) || remoteShipmentId <= 0) {
      throw new BadRequestException('Shiprocket returned an invalid shipment ID');
    }
    const token = await this.getToken();
    const claimed = await this.prisma.shipments.updateMany({
      where: { id: shipment.id, tracking_number: null, status: { in: ['CREATED', 'AWB_FAILED'] } },
      data: {
        status: 'AWB_ASSIGNING',
        ...(courierCompanyId !== undefined ? { courier_id: String(courierCompanyId) } : {}),
        error_message: null,
        updated_at: new Date(),
      },
    });
    if (!claimed.count) {
      return this.toResult(await this.prisma.shipments.findUniqueOrThrow({ where: { id: shipment.id } }));
    }

    try {
      const selectedCourier = (courierCompanyId ?? Number(shipment.courier_id)) || undefined;
      const response = await this.request('/courier/assign/awb', {
        shipment_id: remoteShipmentId,
        ...(selectedCourier ? { courier_id: selectedCourier } : {}),
      }, token);
      const result = response.response?.data ?? response.payload?.response?.data ?? response.payload ?? response;
      if (Number(response.awb_assign_status ?? result.awb_assign_status) === 0 || result.awb_assign_error) {
        throw new Error(String(result.awb_assign_error ?? response.message ?? 'Shiprocket could not assign an AWB'));
      }
      const awb = String(result.awb_code ?? '').trim() || null;
      const updated = await this.prisma.shipments.update({
        where: { id: shipment.id },
        data: {
          status: awb ? 'AWB_ASSIGNED' : 'AWB_ASSIGNING',
          tracking_number: awb,
          courier_id: result.courier_company_id != null
            ? String(result.courier_company_id)
            : selectedCourier != null
              ? String(selectedCourier)
              : shipment.courier_id,
          carrier: result.courier_name ?? shipment.carrier,
          tracking_url: awb ? `https://shiprocket.co/tracking/${awb}` : null,
          label_url: result.label_url ?? null,
          manifest_url: result.manifest_url ?? null,
          error_message: null,
          updated_at: new Date(),
        },
      });
      return this.toResult(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AWB assignment failed';
      const outcomeUncertain = this.hasUncertainCreateOutcome(error);
      await this.prisma.shipments.updateMany({
        where: { id: shipment.id, status: 'AWB_ASSIGNING' },
        data: {
          status: outcomeUncertain ? 'AWB_ASSIGNING' : 'AWB_FAILED',
          error_message: (outcomeUncertain
            ? `${message}; check Shiprocket before retrying AWB assignment`
            : message).slice(0, 1000),
          updated_at: new Date(),
        },
      });
      throw new ServiceUnavailableException(`Shiprocket AWB assignment failed: ${message}`);
    }
  }

  async cancelShipment(orderId: string) {
    let shipment = await this.prisma.shipments.findUnique({ where: { order_id: orderId } });
    if (!shipment || shipment.provider !== 'SHIPROCKET') {
      throw new BadRequestException('No Shiprocket shipment exists for this order');
    }
    if (shipment.status === 'CANCELLED') return this.toResult(shipment);
    if (shipment.status === 'CANCELLING') {
      const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
      if (!shipment.updated_at || shipment.updated_at > staleBefore) {
        throw new ConflictException('Shipment cancellation is already in progress');
      }
      await this.prisma.shipments.updateMany({
        where: { id: shipment.id, status: 'CANCELLING', updated_at: { lte: staleBefore } },
        data: {
          status: 'CANCEL_UNCERTAIN',
          error_message: 'Shipment cancellation was interrupted; reconciling with Shiprocket before retrying',
          updated_at: new Date(),
        },
      });
      shipment = await this.prisma.shipments.findUniqueOrThrow({ where: { id: shipment.id } });
      if (shipment.status === 'CANCELLED') return this.toResult(shipment);
      if (shipment.status === 'CANCELLING') {
        throw new ConflictException('Shipment cancellation is already in progress');
      }
    }
    if (shipment.status === 'CANCEL_UNCERTAIN') {
      const externalOrderId = Number(shipment.provider_order_id);
      if (!Number.isSafeInteger(externalOrderId) || externalOrderId <= 0) {
        throw new ServiceUnavailableException('Cancellation outcome is uncertain and this Shiprocket order cannot be looked up automatically');
      }
      const response = await this.requestGet(`/orders/show/${encodeURIComponent(shipment.provider_order_id!)}`);
      const remote = response.data ?? response.payload ?? response;
      const remoteActivities = Array.isArray(remote.activities) ? remote.activities : [];
      const remoteShipment = Array.isArray(remote.shipments) ? remote.shipments[0] : remote.shipments;
      const remoteStatuses = [remote.status, remoteShipment?.status]
        .map((value) => String(value ?? '').trim().toUpperCase());
      const cancellationConfirmed = remoteStatuses.some((status) => status === 'CANCELLED' || status === 'CANCELED') ||
        remoteActivities.some((activity: unknown) => String(activity).trim().toUpperCase() === 'ORDER_CANCELLED');
      if (cancellationConfirmed) {
        await this.persistCancellation(shipment);
        return this.toResult(await this.prisma.shipments.findUniqueOrThrow({ where: { id: shipment.id } }));
      }
      if (remoteStatuses.some((status) => status.includes('CANCEL'))) {
        throw new ServiceUnavailableException('Shiprocket is still processing the cancellation. Check again before retrying.');
      }
      if (!remoteStatuses.some(Boolean)) {
        throw new ServiceUnavailableException('Shiprocket has not confirmed the cancellation state. Check again before retrying.');
      }
      if (shipment.updated_at > new Date(Date.now() - 2 * 60 * 1000)) {
        throw new ServiceUnavailableException('Shiprocket still reports an active order. Wait briefly for cancellation to settle before retrying.');
      }
      const restored = await this.prisma.shipments.updateMany({
        where: { id: shipment.id, status: 'CANCEL_UNCERTAIN' },
        data: {
          status: shipment.tracking_number ? 'AWB_ASSIGNED' : 'CREATED',
          error_message: null,
          updated_at: new Date(),
        },
      });
      if (!restored.count) throw new ConflictException('Shipment status changed; reload and try again');
      shipment = await this.prisma.shipments.findUniqueOrThrow({ where: { id: shipment.id } });
    }
    const normalizedStatus = shipment.status.toUpperCase().replaceAll('_', ' ');
    if (normalizedStatus.includes('DELIVERED') || normalizedStatus.includes('RETURN')) {
      throw new BadRequestException('Delivered or returned shipments cannot be cancelled');
    }
    const cancelOrder = !shipment.tracking_number;
    const externalOrderId = Number(shipment.provider_order_id);
    if (cancelOrder && (!shipment.provider_order_id || !Number.isSafeInteger(externalOrderId) || externalOrderId <= 0)) {
      throw new BadRequestException('This Shiprocket order has no cancellable AWB or order ID');
    }
    const claimed = await this.prisma.shipments.updateMany({
      where: { id: shipment.id, status: shipment.status, tracking_number: shipment.tracking_number },
      data: { status: 'CANCELLING', error_message: null, updated_at: new Date() },
    });
    if (!claimed.count) throw new ConflictException('Shipment status changed; reload and try again');

    try {
      await this.request(
        cancelOrder ? '/orders/cancel' : '/orders/cancel/shipment/awbs',
        cancelOrder ? { ids: [externalOrderId] } : { awbs: [shipment.tracking_number] },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Shiprocket cancellation failed';
      const outcomeUncertain = this.hasUncertainCreateOutcome(error);
      await this.prisma.shipments.updateMany({
        where: { id: shipment.id, status: 'CANCELLING' },
        data: {
          status: outcomeUncertain ? 'CANCEL_UNCERTAIN' : shipment.status,
          error_message: message.slice(0, 1000),
          updated_at: new Date(),
        },
      });
      throw new ServiceUnavailableException(outcomeUncertain
        ? `Shiprocket cancellation may have been accepted; check provider status before retrying: ${message}`
        : `Shiprocket cancellation failed: ${message}`);
    }

    await this.persistCancellation(shipment);
    return this.toResult(await this.prisma.shipments.findUniqueOrThrow({ where: { id: shipment.id } }));
  }

  private async persistCancellation(shipment: Prisma.shipmentsGetPayload<{}>) {
    await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.shipments.updateMany({
        where: { id: shipment.id, status: { in: ['CANCELLING', 'CANCEL_UNCERTAIN'] }, tracking_number: shipment.tracking_number },
        data: { status: 'CANCELLED', error_message: null, updated_at: new Date() },
      });
      if (!cancelled.count) return;
      await tx.delivery_tracking_events.createMany({
        data: [{
          shipment_id: shipment.id,
          status: 'CANCELLED',
          description: 'Shiprocket fulfillment cancelled by an administrator',
          provider_event_key: createHash('sha256').update(`admin-cancel:${shipment.id}:${shipment.provider_order_id}`).digest('hex'),
        }],
        skipDuplicates: true,
      });
    });
  }

  async handleWebhook(apiKey: string | undefined, body: Record<string, any>) {
    const secret = this.config.get<string>('SHIPROCKET_WEBHOOK_SECRET');
    if (!secret || !apiKey || !this.constantTimeEquals(secret, apiKey)) {
      throw new BadRequestException('Invalid shipment webhook key');
    }
    const awb = String(body.awb ?? body.awb_code ?? body.awbCode ?? '').trim();
    const shipmentId = String(body.shipment_id ?? body.shipmentId ?? '').trim();
    const shipment = await this.prisma.shipments.findFirst({
      where: { provider: 'SHIPROCKET', OR: [
        ...(awb ? [{ tracking_number: awb }] : []),
        ...(shipmentId ? [{ provider_shipment_id: shipmentId }] : []),
      ] },
    });
    if (!shipment) return { accepted: true, matched: false };

    const rawStatus = String(body.current_status ?? body.status ?? body.shipment_status ?? 'UPDATE').trim();
    const status = this.mapStatus(rawStatus);
    const eventKey = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const parsedTime = body.date ? Date.parse(String(body.date)) : NaN;
    const occurredAt = Number.isFinite(parsedTime) ? new Date(parsedTime) : new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${shipment.order_id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM shipments WHERE id = ${shipment.id}::uuid FOR UPDATE`;
      const [currentOrder, currentShipment, latestEvent] = await Promise.all([
        tx.orders.findUnique({ where: { id: shipment.order_id }, select: { status: true } }),
        tx.shipments.findUnique({ where: { id: shipment.id } }),
        tx.delivery_tracking_events.findFirst({
          where: { shipment_id: shipment.id },
          orderBy: [{ occurred_at: 'desc' }, { created_at: 'desc' }],
          select: { occurred_at: true },
        }),
      ]);
      const inserted = await tx.delivery_tracking_events.createMany({
        data: [{
          shipment_id: shipment.id,
          status: rawStatus.slice(0, 100),
          location: String(body.current_city ?? body.location ?? '').slice(0, 255) || null,
          description: String(body.activity ?? body.status_description ?? body.message ?? '').slice(0, 2000) || null,
          provider_event_key: eventKey,
          occurred_at: occurredAt,
        }],
        skipDuplicates: true,
      });
      if (inserted.count > 0) {
        if (!currentShipment || !currentOrder) return;
        if (latestEvent && occurredAt < latestEvent.occurred_at) return;
        const terminal = ['CANCELLED', 'RETURNED', 'REFUNDED'].includes(currentOrder.status);
        if (terminal) return;
        const currentShipmentStatus = this.mapStatus(currentShipment.status);
        if (status && currentShipmentStatus &&
          (currentShipmentStatus === order_status.CANCELLED ||
            (fulfillmentStatusRank[status] ?? -1) < (fulfillmentStatusRank[currentShipmentStatus] ?? -1))) return;

        await tx.shipments.update({ where: { id: shipment.id }, data: {
          status: status === order_status.CANCELLED ? 'CANCELLED' : rawStatus.slice(0, 100),
          ...(status === order_status.SHIPPED ? { shipped_at: occurredAt } : {}),
          ...(status === order_status.DELIVERED ? { delivered_at: occurredAt } : {}),
          updated_at: new Date(),
        } });

        if (!status) return;
        if (status === order_status.CANCELLED) {
          return;
        }
        const forward = (fulfillmentStatusRank[status] ?? 0) >= (fulfillmentStatusRank[currentOrder.status] ?? 0);
        if (forward && status !== currentOrder.status) {
          await tx.orders.update({ where: { id: shipment.order_id }, data: { status, updated_at: new Date() } });
        }
      }
    });
    return { accepted: true, matched: true };
  }

  private async request(path: string, body: Record<string, unknown>, token?: string) {
    const authToken = token ?? await this.getToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json().catch(() => ({})) as ShiprocketResponse;
    if (!response.ok) throw new ShiprocketHttpError(String(data.message ?? data.error ?? `Shiprocket HTTP ${response.status}`), response.status);
    if (data.success === false || data.error || Number(data.status) === 0 || Number(data.status) >= 400) {
      throw new Error(String(data.message ?? data.error_message ?? 'Shiprocket rejected the request'));
    }
    return data;
  }

  private async requestGet(path: string) {
    const token = await this.getToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json().catch(() => ({})) as ShiprocketResponse;
    if (!response.ok) throw new ServiceUnavailableException(String(data.message ?? data.error ?? `Shiprocket HTTP ${response.status}`));
    if (data.success === false || data.error || Number(data.status) === 0 || Number(data.status) >= 400) {
      throw new ServiceUnavailableException(String(data.message ?? data.error_message ?? 'Shiprocket tracking request failed'));
    }
    return data;
  }

  private async getToken() {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    const email = this.config.get<string>('SHIPROCKET_EMAIL');
    const password = this.config.get<string>('SHIPROCKET_PASSWORD');
    if (!email || !password) throw new ServiceUnavailableException('Shiprocket credentials are not configured');
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json().catch(() => ({})) as ShiprocketResponse;
    if (!response.ok || !data.token) throw new ServiceUnavailableException('Shiprocket authentication failed');
    this.token = data.token;
    this.tokenExpiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;
    return this.token;
  }

  private mapStatus(value: string): order_status | undefined {
    const normalized = value.toUpperCase().replaceAll('_', ' ');
    if (normalized.includes('CANCEL')) return order_status.CANCELLED;
    if (normalized === 'RETURNED' || normalized.includes('RTO DELIVERED') || normalized.includes('RETURN DELIVERED')) return order_status.RETURNED;
    if (normalized.includes('DELIVERED')) return order_status.DELIVERED;
    if (normalized.includes('OUT FOR DELIVERY')) return order_status.OUT_FOR_DELIVERY;
    if (normalized.includes('PICKED UP') || normalized.includes('IN TRANSIT') || normalized === 'SHIPPED') return order_status.SHIPPED;
    return undefined;
  }

  private constantTimeEquals(expected: string, actual: string) {
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private toResult(shipment: Prisma.shipmentsGetPayload<{}>) {
    return {
      provider: shipment.provider,
      providerOrderId: shipment.provider_order_id,
      providerShipmentId: shipment.provider_shipment_id,
      trackingNumber: shipment.tracking_number,
      carrier: shipment.carrier,
      status: shipment.status,
      trackingUrl: shipment.tracking_url,
      labelUrl: shipment.label_url,
      manifestUrl: shipment.manifest_url,
      error: shipment.error_message,
    };
  }
}
