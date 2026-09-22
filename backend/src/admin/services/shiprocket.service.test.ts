import assert from 'node:assert/strict';
import { test } from 'node:test';
import { order_status, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ShiprocketService } from './shiprocket.service';

test('Shiprocket return statuses map to returned without implying a refund', () => {
  const service = new ShiprocketService({} as PrismaService, { get: () => undefined } as never);
  const mapStatus = (service as unknown as { mapStatus: (status: string) => order_status | undefined }).mapStatus.bind(service);

  assert.equal(mapStatus('RETURNED'), order_status.RETURNED);
  assert.equal(mapStatus('RTO Delivered'), order_status.RETURNED);
  assert.notEqual(mapStatus('RETURNED'), order_status.REFUNDED);
});

test('Shiprocket webhook rejects missing or incorrect shared secrets before database access', async () => {
  const service = new ShiprocketService({} as PrismaService, {
    get: (key: string) => key === 'SHIPROCKET_WEBHOOK_SECRET' ? 'configured-secret' : undefined,
  } as never);

  await assert.rejects(service.handleWebhook(undefined, {}), /Invalid shipment webhook key/);
  await assert.rejects(service.handleWebhook('wrong-secret', {}), /Invalid shipment webhook key/);
});

test('Shiprocket webhook applies a delivery event once and ignores its duplicate', async () => {
  const shipment = {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: '11111111-1111-4111-8111-111111111111',
    provider: 'SHIPROCKET',
    tracking_number: 'AWB-123',
    provider_shipment_id: '99',
    status: 'IN TRANSIT',
  };
  let storedEvent: Record<string, unknown> | undefined;
  let shipmentUpdates = 0;
  let orderUpdates = 0;
  const prisma = {
    shipments: {
      findFirst: async () => shipment,
      findUnique: async () => shipment,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        shipmentUpdates += 1;
        Object.assign(shipment, data);
      },
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      $queryRaw: async () => [],
      orders: {
        findUnique: async () => ({ status: 'SHIPPED' }),
        update: async () => { orderUpdates += 1; },
      },
      shipments: {
        findUnique: async () => shipment,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          shipmentUpdates += 1;
          Object.assign(shipment, data);
        },
      },
      delivery_tracking_events: {
        findFirst: async () => storedEvent ? { occurred_at: storedEvent.occurred_at } : null,
        createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
          if (storedEvent) return { count: 0 };
          storedEvent = data[0];
          return { count: 1 };
        },
      },
    }),
  } as unknown as PrismaService;
  const service = new ShiprocketService(prisma, {
    get: (key: string) => key === 'SHIPROCKET_WEBHOOK_SECRET' ? 'configured-secret' : undefined,
  } as never);
  const body = {
    awb: 'AWB-123',
    current_status: 'DELIVERED',
    date: '2026-09-22 10:00:00',
    activity: 'Delivered to recipient',
  };

  assert.deepEqual(await service.handleWebhook('configured-secret', body), { accepted: true, matched: true });
  assert.equal(shipment.status, 'DELIVERED');
  assert.equal(shipmentUpdates, 1);
  assert.equal(orderUpdates, 1);

  assert.deepEqual(await service.handleWebhook('configured-secret', body), { accepted: true, matched: true });
  assert.equal(shipmentUpdates, 1);
  assert.equal(orderUpdates, 1);
});

test('Shiprocket webhook records but does not apply a later status regression', async () => {
  const shipment = {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: '11111111-1111-4111-8111-111111111111',
    provider: 'SHIPROCKET',
    tracking_number: 'AWB-123',
    provider_shipment_id: '99',
    status: 'DELIVERED',
  };
  let eventCount = 0;
  let shipmentUpdates = 0;
  let orderUpdates = 0;
  const prisma = {
    shipments: { findFirst: async () => shipment },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      $queryRaw: async () => [],
      orders: {
        findUnique: async () => ({ status: 'DELIVERED' }),
        update: async () => { orderUpdates += 1; },
      },
      shipments: {
        findUnique: async () => shipment,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          shipmentUpdates += 1;
          Object.assign(shipment, data);
        },
      },
      delivery_tracking_events: {
        findFirst: async () => ({ occurred_at: new Date('2026-09-22T10:00:00Z') }),
        createMany: async () => { eventCount += 1; return { count: 1 }; },
      },
    }),
  } as unknown as PrismaService;
  const service = new ShiprocketService(prisma, {
    get: (key: string) => key === 'SHIPROCKET_WEBHOOK_SECRET' ? 'configured-secret' : undefined,
  } as never);

  const result = await service.handleWebhook('configured-secret', {
    awb: 'AWB-123',
    current_status: 'IN TRANSIT',
    date: '2026-09-22 11:00:00',
  });

  assert.deepEqual(result, { accepted: true, matched: true });
  assert.equal(eventCount, 1);
  assert.equal(shipment.status, 'DELIVERED');
  assert.equal(shipmentUpdates, 0);
  assert.equal(orderUpdates, 0);
});

test('a cancelled carrier booking gets a new persisted channel reference before rebooking', async () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const shipment: Record<string, any> = {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: orderId,
    provider: 'SHIPROCKET',
    provider_order_id: '88',
    provider_reference_id: orderId.replaceAll('-', '').slice(0, 20),
    provider_shipment_id: '99',
    tracking_number: 'AWB-OLD',
    status: 'CANCELLED',
    error_message: null,
  };
  const prisma = {
    orders: { findUnique: async () => ({
      id: orderId,
      shipping_type: 'STANDARD',
      status: 'PROCESSING',
      payment_status: 'SUCCESS',
      payment_method: 'CARD',
    }) },
    shipments: {
      findUnique: async () => shipment,
      findUniqueOrThrow: async () => shipment,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(shipment, data);
        return { count: 1 };
      },
    },
    order_items: { findMany: async () => [] },
    user_addresses: { findUnique: async () => null },
    users: { findUnique: async () => null },
    seller_profiles: { findFirst: async () => null },
  } as unknown as PrismaService;
  const service = new ShiprocketService(prisma, { get: () => undefined } as never);

  await assert.rejects(service.fulfillOrder(orderId));
  assert.notEqual(shipment.provider_reference_id, orderId.replaceAll('-', '').slice(0, 20));
  assert.equal(shipment.provider_order_id, null);
  assert.equal(shipment.provider_shipment_id, null);
  assert.equal(shipment.tracking_number, null);
});

test('Shiprocket reconciles an accepted create after a network failure and assigns its AWB', async () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const shipment = {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: orderId,
    provider: null,
    provider_order_id: null,
    provider_shipment_id: null,
    tracking_number: null,
    tracking_url: null,
    carrier: null,
    courier_id: null,
    label_url: null,
    manifest_url: null,
    pickup_scheduled_at: null,
    error_message: null,
    status: 'PROCESSING',
    shipped_at: null,
    delivered_at: null,
    estimated_date: null,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const persisted = { ...shipment };
  let createClaimTimestamp: Date | undefined;
  const order = {
    id: orderId,
    buyer_id: '44444444-4444-4444-8444-444444444444',
    seller_id: '55555555-5555-4555-8555-555555555555',
    shipping_type: 'STANDARD',
    status: 'CONFIRMED',
    payment_status: 'SUCCESS',
    payment_method: 'CARD',
    created_at: new Date('2026-09-20T10:00:00Z'),
    shipping_address_id: '66666666-6666-4666-8666-666666666666',
    buyer_name: 'Test Buyer',
    buyer_email: null,
    buyer_mobile: null,
    shipping_address_snapshot: {
      addressLine1: '10 Market Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001', country: 'India',
    },
    shipping_fee: 0,
  };
  const item = {
    product_id: '33333333-3333-4333-8333-333333333333',
    variant_id: null,
    product_name: 'Test item',
    sku: 'TEST-1',
    quantity: 1,
    unit_price: new Prisma.Decimal(100),
    tax_rate: 5,
    tax_amount: new Prisma.Decimal(5),
    discount_amount: new Prisma.Decimal(0.1),
    total_price: new Prisma.Decimal(104.9),
    weight_grams: 500,
    length_cm: 10,
    width_cm: 10,
    height_cm: 10,
  };
  const prisma = {
    orders: { findUnique: async () => order },
    users: {
      findUnique: async ({ where }: { where: { id: string } }) => where.id === order.buyer_id
        ? { id: order.buyer_id, full_name: 'Test Buyer', email: 'buyer@example.test', mobile: '9999999999' }
        : { id: order.seller_id, full_name: 'Test Seller', email: 'seller@example.test', mobile: '8888888888' },
    },
    seller_profiles: { findFirst: async () => ({
      id: order.seller_id,
      user_id: order.seller_id,
      business_name: 'Test Store',
      shiprocket_pickup_location: 'Seller Pune',
      shiprocket_pickup_address: '25 Warehouse Market Road',
      shiprocket_pickup_address_2: 'Warehouse Unit 3',
      shiprocket_pickup_city: 'Pune',
      shiprocket_pickup_state: 'Maharashtra',
      shiprocket_pickup_country: 'India',
      shiprocket_pickup_pin_code: '411001',
    }) },
    shipments: {
      findUnique: async () => ({ ...persisted }),
      updateMany: async ({ where, data }: { where: { status?: { in?: string[] } }; data: Record<string, unknown> }) => {
        if (where.status?.in && !where.status.in.includes(persisted.status)) return { count: 0 };
        if (data.status === 'CREATING') createClaimTimestamp = data.updated_at as Date;
        Object.assign(persisted, data);
        return { count: 1 };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(persisted, data),
    },
    order_items: { findMany: async () => [item] },
    user_addresses: { findUnique: async () => ({
      full_name: 'Updated Buyer', address_line1: '99 Changed Street', address_line2: null,
      city: 'Mumbai', state: 'Maharashtra', postal_code: '400001', country: 'India',
    }) },
    products: { findMany: async () => [{ id: item.product_id }] },
    product_variants: { findMany: async () => [] },
    product_images: { findMany: async () => [] },
  } as unknown as PrismaService;
  const config = {
    get: (key: string) => ({
      SHIPROCKET_API_URL: 'https://shiprocket.test/v1/external',
      SHIPROCKET_EMAIL: 'api@example.test',
      SHIPROCKET_PASSWORD: 'secret',
      SHIPROCKET_PICKUP_LOCATION: 'Main Warehouse',
    } as Record<string, string>)[key],
  };
  const originalFetch = global.fetch;
  const requests: Array<{ url: string; body?: Record<string, unknown> }> = [];
  global.fetch = (async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    requests.push({ url, body });
    if (url.endsWith('/shipments/create/forward-shipment')) throw new TypeError('fetch failed');
    const response = url.endsWith('/auth/login')
      ? { token: 'test-token' }
      : url.endsWith('/orders')
        ? { data: [{
            id: 88,
            channel_order_id: orderId.replaceAll('-', '').slice(0, 20),
            shipments: [{ id: 99, awb: '', courier: '', courier_id: '' }],
          }] }
        : { awb_assign_status: 1, response: { data: { awb_code: 'AWB-123', courier_company_id: 43, courier_name: 'Test Courier' } } };
    return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const result = await new ShiprocketService(prisma, config as never).fulfillOrder(orderId, 43);
    assert.equal(result.providerOrderId, '88');
    assert.equal(result.providerShipmentId, '99');
    assert.equal(result.trackingNumber, 'AWB-123');
    assert.equal(result.carrier, 'Test Courier');
    assert.equal(persisted.status, 'AWB_ASSIGNED');
    assert.ok(requests.some((request) => request.url.endsWith('/courier/assign/awb') && request.body?.shipment_id === 99 && request.body?.courier_id === 43));
    assert.equal(persisted.courier_id, '43');
    assert.ok(createClaimTimestamp && Date.now() - createClaimTimestamp.getTime() < 2_000);
    assert.ok(requests.some((request) => request.url.endsWith('/orders')));
    assert.equal(requests.filter((request) => request.url.endsWith('/shipments/create/forward-shipment')).length, 1);
    const forward = requests.find((request) => request.url.endsWith('/shipments/create/forward-shipment'))?.body;
    assert.equal(forward?.courier_id, 43);
    assert.equal(forward?.billing_email, 'buyer@example.test');
    assert.equal(forward?.billing_phone, '9999999999');
    assert.equal(forward?.billing_address, '10 Market Road');
    assert.equal(forward?.billing_city, 'Pune');
    assert.equal(forward?.billing_pincode, '411001');
    assert.equal(forward?.pickup_location, 'Seller Pune');
    assert.equal(forward?.sub_total, 104.9);
    assert.equal(forward?.total_discount, 0.1);
    const shippedItem = (forward?.order_items as Array<Record<string, unknown>>)[0];
    assert.equal(shippedItem.selling_price, 105);
    assert.equal(shippedItem.discount, 0.1);
    assert.deepEqual(forward?.vendor_details, {
      email: 'seller@example.test',
      phone: '8888888888',
      name: 'Test Seller',
      address: '25 Warehouse Market Road',
      address_2: 'Warehouse Unit 3',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      pin_code: '411001',
      pickup_location: 'Seller Pune',
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('Shiprocket rejects a short nonblank optional seller pickup address line before sending', async () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const shipment: Record<string, any> = {
    id: '22222222-2222-4222-8222-222222222222', order_id: orderId,
    provider: null, provider_order_id: null, provider_shipment_id: null,
    tracking_number: null, status: 'PROCESSING', updated_at: new Date(),
  };
  const order = {
    id: orderId, buyer_id: null, seller_id: '55555555-5555-4555-8555-555555555555',
    shipping_type: 'STANDARD', status: 'CONFIRMED', payment_status: 'SUCCESS', payment_method: 'CARD',
    created_at: new Date(), shipping_address_id: '66666666-6666-4666-8666-666666666666',
    buyer_name: 'Buyer', buyer_email: 'buyer@example.test', buyer_mobile: '9999999999',
    shipping_address_snapshot: {
      addressLine1: '10 Market Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001',
    },
  };
  const prisma = {
    orders: { findUnique: async () => order },
    shipments: {
      findUnique: async () => shipment,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(shipment, data); return { count: 1 }; },
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(shipment, data),
    },
    order_items: { findMany: async () => [{
      product_id: '33333333-3333-4333-8333-333333333333', variant_id: null,
      product_name: 'Test item', sku: 'TEST-1', quantity: 1,
      unit_price: new Prisma.Decimal(100), tax_rate: new Prisma.Decimal(0),
      tax_amount: new Prisma.Decimal(0), total_price: new Prisma.Decimal(100),
      weight_grams: 500, length_cm: new Prisma.Decimal(10),
      width_cm: new Prisma.Decimal(10), height_cm: new Prisma.Decimal(10),
    }] },
    user_addresses: { findUnique: async () => null },
    users: { findUnique: async () => ({ full_name: 'Seller', email: 'seller@example.test', mobile: '8888888888' }) },
    seller_profiles: { findFirst: async () => ({
      id: order.seller_id, user_id: order.seller_id, business_name: 'Test Store',
      shiprocket_pickup_location: 'Seller Pune', shiprocket_pickup_address: '25 Warehouse Market Road',
      shiprocket_pickup_address_2: 'Unit 3', shiprocket_pickup_city: 'Pune',
      shiprocket_pickup_state: 'Maharashtra', shiprocket_pickup_country: 'India',
      shiprocket_pickup_pin_code: '411001',
    }) },
    products: { findMany: async () => [{ id: '33333333-3333-4333-8333-333333333333' }] },
    product_variants: { findMany: async () => [] },
  } as unknown as PrismaService;
  const originalFetch = global.fetch;
  let requests = 0;
  global.fetch = (async () => { requests += 1; throw new Error('Unexpected Shiprocket request'); }) as typeof fetch;

  try {
    const service = new ShiprocketService(prisma, { get: () => undefined } as never);
    await assert.rejects(service.fulfillOrder(orderId), /address line 2 must be at least 10 characters/);
    assert.equal(requests, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Shiprocket courier quotes use the order package and pickup/delivery postcodes', async () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const order = {
    id: orderId,
    seller_id: null,
    shipping_type: 'STANDARD',
    status: 'CONFIRMED',
    payment_method: 'COD',
    shipping_address_id: '66666666-6666-4666-8666-666666666666',
    shipping_address_snapshot: { postalCode: '411001' },
    total_amount: new Prisma.Decimal(499),
  };
  const item = {
    product_id: '33333333-3333-4333-8333-333333333333',
    variant_id: null,
    quantity: 2,
    weight_grams: 600,
    length_cm: new Prisma.Decimal(12),
    width_cm: new Prisma.Decimal(10),
    height_cm: new Prisma.Decimal(8),
  };
  const prisma = {
    orders: { findUnique: async () => order },
    order_items: { findMany: async () => [item] },
    user_addresses: { findUnique: async () => ({ postal_code: '400001' }) },
    seller_profiles: { findFirst: async () => null },
  } as unknown as PrismaService;
  const config = {
    get: (key: string) => ({
      SHIPROCKET_API_URL: 'https://shiprocket.test/v1/external',
      SHIPROCKET_EMAIL: 'api@example.test',
      SHIPROCKET_PASSWORD: 'secret',
      SHIPROCKET_PICKUP_POSTCODE: '400001',
    } as Record<string, string>)[key],
  };
  const originalFetch = global.fetch;
  let requestUrl = '';
  global.fetch = (async (input) => {
    requestUrl = String(input);
    const response = requestUrl.endsWith('/auth/login')
      ? { token: 'test-token' }
      : { data: { available_courier_companies: [
          { courier_company_id: 10, courier_name: 'Express', rates: '54', estimated_delivery_days: '2', cod: 1, blocked: 0 },
          { courier_company_id: 11, courier_name: 'Blocked', freight_charge: 40, cod: 1, blocked: 1 },
          { courier_company_id: 12, courier_name: 'Prepaid only', freight_charge: 35, cod: 0, blocked: 0 },
        ] } };
    return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const result = await new ShiprocketService(prisma, config as never).getCourierOptions(orderId);
    const url = new URL(requestUrl);
    assert.equal(url.pathname, '/v1/external/courier/serviceability/');
    assert.equal(url.searchParams.get('pickup_postcode'), '400001');
    assert.equal(url.searchParams.get('delivery_postcode'), '411001');
    assert.equal(url.searchParams.get('cod'), '1');
    assert.equal(url.searchParams.get('weight'), '1.2');
    assert.equal(url.searchParams.get('declared_value'), '499');
    assert.deepEqual(result.items, [{
      courierCompanyId: 10,
      courierName: 'Express',
      freightCharge: 54,
      estimatedDeliveryDays: '2',
      estimatedDelivery: null,
      codAvailable: true,
      minWeight: null,
    }]);

    global.fetch = (async (input) => {
      const response = String(input).endsWith('/auth/login')
        ? { token: 'test-token' }
        : { status: 404, message: 'Order does not exist' };
      return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    await assert.rejects(
      new ShiprocketService(prisma, config as never).getCourierOptions(orderId),
      /Order does not exist/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('an AWB assignment refresh checks Shiprocket before retrying and works after the order ships', async () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const shipment = {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: orderId,
    provider: 'SHIPROCKET',
    provider_order_id: '88',
    provider_shipment_id: '99',
    tracking_number: null,
    tracking_url: null,
    courier_id: null,
    carrier: null,
    status: 'AWB_ASSIGNING',
    error_message: null,
  };
  const requests: string[] = [];
  const prisma = {
    orders: { findUnique: async () => ({ id: orderId, shipping_type: 'STANDARD', status: 'SHIPPED' }) },
    shipments: {
      findUnique: async () => shipment,
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(shipment, data),
    },
  } as unknown as PrismaService;
  const config = {
    get: (key: string) => ({
      SHIPROCKET_API_URL: 'https://shiprocket.test/v1/external',
      SHIPROCKET_EMAIL: 'api@example.test',
      SHIPROCKET_PASSWORD: 'secret',
    } as Record<string, string>)[key],
  };
  const originalFetch = global.fetch;
  global.fetch = (async (input) => {
    const url = String(input);
    requests.push(url);
    const response = url.endsWith('/auth/login')
      ? { token: 'test-token' }
      : { data: { id: 88, shipments: { id: 99, awb: 'AWB-456', courier_id: 11, courier: 'Test Courier' } } };
    return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const result = await new ShiprocketService(prisma, config as never).fulfillOrder(orderId);
    assert.equal(result.trackingNumber, 'AWB-456');
    assert.equal(result.carrier, 'Test Courier');
    assert.ok(requests.some((url) => url.endsWith('/orders/show/88')));
    assert.ok(!requests.some((url) => url.endsWith('/courier/assign/awb')));
  } finally {
    global.fetch = originalFetch;
  }
});

test('an ambiguous AWB response stays pending and is checked instead of resubmitted', async () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const shipment: Record<string, any> = {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: orderId,
    provider: 'SHIPROCKET',
    provider_order_id: '88',
    provider_shipment_id: '99',
    tracking_number: null,
    status: 'CREATED',
    error_message: null,
  };
  const requests: string[] = [];
  const prisma = {
    orders: { findUnique: async () => ({
      id: orderId,
      shipping_type: 'STANDARD',
      status: 'PROCESSING',
      payment_status: 'SUCCESS',
      payment_method: 'CARD',
    }) },
    shipments: {
      findUnique: async () => shipment,
      findUniqueOrThrow: async () => shipment,
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(shipment, data),
      updateMany: async ({ where, data }: { where: { status?: { in?: string[] } | string }; data: Record<string, unknown> }) => {
        if (typeof where.status === 'object' && where.status.in && !where.status.in.includes(shipment.status)) {
          return { count: 0 };
        }
        if (typeof where.status === 'string' && where.status !== shipment.status) return { count: 0 };
        Object.assign(shipment, data);
        return { count: 1 };
      },
    },
  } as unknown as PrismaService;
  const config = {
    get: (key: string) => ({
      SHIPROCKET_API_URL: 'https://shiprocket.test/v1/external',
      SHIPROCKET_EMAIL: 'api@example.test',
      SHIPROCKET_PASSWORD: 'secret',
    } as Record<string, string>)[key],
  };
  const originalFetch = global.fetch;
  global.fetch = (async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith('/courier/assign/awb')) throw new TypeError('fetch failed');
    const response = url.endsWith('/auth/login')
      ? { token: 'test-token' }
      : { data: { id: 88, shipments: { id: 99, awb: '' } } };
    return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const service = new ShiprocketService(prisma, config as never);
    await assert.rejects(service.fulfillOrder(orderId));
    assert.equal(shipment.status, 'AWB_ASSIGNING');
    await service.fulfillOrder(orderId);
    assert.equal(requests.filter((url) => url.endsWith('/courier/assign/awb')).length, 1);
    assert.equal(requests.filter((url) => url.endsWith('/orders/show/88')).length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('a later but regressive tracking refresh does not undo delivered shipment state', async () => {
  const shipment = {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: '11111111-1111-4111-8111-111111111111',
    provider: 'SHIPROCKET',
    provider_shipment_id: '99',
    tracking_number: 'AWB-123',
    tracking_url: null,
    courier_id: null,
    status: 'DELIVERED',
    shipped_at: new Date('2026-09-19T12:00:00Z'),
    delivered_at: new Date('2026-09-20T12:00:00Z'),
  };
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const updates: Array<Record<string, unknown>> = [];
  let orderUpdates = 0;
  const tx = {
    delivery_tracking_events: {
      findFirst: async () => ({ occurred_at: yesterday }),
      createMany: async () => ({ count: 1 }),
    },
    orders: {
      findUnique: async () => ({ status: 'DELIVERED' }),
      updateMany: async () => { orderUpdates += 1; return { count: 1 }; },
    },
    shipments: {
      findUnique: async () => shipment,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        Object.assign(shipment, data);
        return shipment;
      },
    },
  };
  const prisma = {
    shipments: {
      findUnique: async () => shipment,
      findUniqueOrThrow: async () => shipment,
    },
    orders: { findUnique: async () => ({ status: 'DELIVERED' }) },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const config = {
    get: (key: string) => ({
      SHIPROCKET_API_URL: 'https://shiprocket.test/v1/external',
      SHIPROCKET_EMAIL: 'api@example.test',
      SHIPROCKET_PASSWORD: 'secret',
    } as Record<string, string>)[key],
  };
  const originalFetch = global.fetch;
  global.fetch = (async (input) => {
    const url = String(input);
    const response = url.endsWith('/auth/login')
      ? { token: 'test-token' }
      : { tracking_data: {
          shipment_track: [{ awb_code: 'AWB-123', current_status: 'IN TRANSIT', courier_company_id: 10 }],
          shipment_track_activities: [{ date: new Date().toISOString(), status: 'X-PPOM', activity: 'In transit' }],
        } };
    return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const result = await new ShiprocketService(prisma, config as never).refreshTracking(shipment.order_id);
    assert.equal(result.status, 'DELIVERED');
    assert.equal(shipment.status, 'DELIVERED');
    assert.equal(updates.length, 1);
    assert.equal(updates[0].status, undefined);
    assert.equal(orderUpdates, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('tracking refresh promotes a delivered order to returned after an RTO delivery scan', async () => {
  const shipment = {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: '11111111-1111-4111-8111-111111111111',
    provider: 'SHIPROCKET',
    provider_shipment_id: '99',
    tracking_number: 'AWB-123',
    status: 'DELIVERED',
  };
  const order = { status: 'DELIVERED' };
  const updates: Array<Record<string, unknown>> = [];
  const tx = {
    delivery_tracking_events: {
      findFirst: async () => ({ occurred_at: new Date(Date.now() - 24 * 60 * 60 * 1000) }),
      createMany: async () => ({ count: 1 }),
    },
    orders: {
      findUnique: async () => order,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        Object.assign(order, data);
        return { count: 1 };
      },
    },
    shipments: {
      findUnique: async () => shipment,
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(shipment, data),
    },
  };
  const prisma = {
    shipments: { findUnique: async () => shipment, findUniqueOrThrow: async () => shipment },
    orders: { findUnique: async () => order },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const config = {
    get: (key: string) => ({
      SHIPROCKET_API_URL: 'https://shiprocket.test/v1/external',
      SHIPROCKET_EMAIL: 'api@example.test',
      SHIPROCKET_PASSWORD: 'secret',
    } as Record<string, string>)[key],
  };
  const originalFetch = global.fetch;
  global.fetch = (async (input) => {
    const response = String(input).endsWith('/auth/login')
      ? { token: 'test-token' }
      : { tracking_data: {
          shipment_track: [{ awb_code: 'AWB-123', current_status: 'RTO DELIVERED' }],
          shipment_track_activities: [{ date: new Date().toISOString(), status: 'RTOD', activity: 'Returned to origin' }],
        } };
    return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    await new ShiprocketService(prisma, config as never).refreshTracking(shipment.order_id);
    assert.equal(order.status, 'RETURNED');
    assert.equal(updates[0].status, 'RETURNED');
  } finally {
    global.fetch = originalFetch;
  }
});

test('stale Shiprocket creates reconcile by the stable local reference instead of creating twice', async () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const shipment: Record<string, any> = {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: orderId,
    provider: 'SHIPROCKET',
    provider_order_id: null,
    provider_shipment_id: null,
    tracking_number: null,
    courier_id: null,
    carrier: null,
    tracking_url: null,
    label_url: null,
    manifest_url: null,
    status: 'CREATING',
    updated_at: new Date(Date.now() - 5 * 60 * 1000),
    provider_reference_id: orderId.replaceAll('-', '').slice(0, 20),
  };
  const order = {
    id: orderId,
    shipping_type: 'STANDARD',
    status: 'CONFIRMED',
    payment_status: 'SUCCESS',
    payment_method: 'CARD',
  };
  const requests: string[] = [];
  const prisma = {
    orders: { findUnique: async () => order },
    shipments: {
      findUnique: async () => shipment,
      findUniqueOrThrow: async () => shipment,
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(shipment, data),
      updateMany: async ({ where, data }: { where: { status?: string | { in?: string[] }; updated_at?: { lte: Date } }; data: Record<string, unknown> }) => {
        if (typeof where.status === 'string' && shipment.status !== where.status) return { count: 0 };
        if (typeof where.status === 'object' && where.status.in && !where.status.in.includes(shipment.status)) return { count: 0 };
        if (where.updated_at?.lte && shipment.updated_at > where.updated_at.lte) return { count: 0 };
        Object.assign(shipment, data);
        return { count: 1 };
      },
    },
  } as unknown as PrismaService;
  const config = {
    get: (key: string) => ({
      SHIPROCKET_API_URL: 'https://shiprocket.test/v1/external',
      SHIPROCKET_EMAIL: 'api@example.test',
      SHIPROCKET_PASSWORD: 'secret',
    } as Record<string, string>)[key],
  };
  const originalFetch = global.fetch;
  global.fetch = (async (input) => {
    const url = String(input);
    requests.push(url);
    const response = url.endsWith('/auth/login')
      ? { token: 'test-token' }
      : url.includes('/orders')
        ? url.endsWith('/orders')
          ? { data: [], meta: { pagination: { current_page: 1, total_pages: 2 } } }
          : { data: [{
            id: 88,
            channel_order_id: orderId.replaceAll('-', '').slice(0, 20),
            shipments: [{ id: 99, awb: '', courier: '', courier_id: '' }],
          }], meta: { pagination: { current_page: 2, total_pages: 2 } } }
        : { awb_assign_status: 1, response: { data: { awb_code: 'AWB-RECOVERED', courier_company_id: 10, courier_name: 'Recovered Courier' } } };
    return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const result = await new ShiprocketService(prisma, config as never).fulfillOrder(orderId);
    assert.equal(result.providerOrderId, '88');
    assert.equal(result.providerShipmentId, '99');
    assert.equal(result.trackingNumber, 'AWB-RECOVERED');
    assert.equal(shipment.status, 'AWB_ASSIGNED');
    assert.ok(requests.some((url) => url.endsWith('/orders')));
    assert.ok(requests.some((url) => url.endsWith('/orders?page=2')));
    assert.ok(!requests.some((url) => url.endsWith('/shipments/create/forward-shipment')));
  } finally {
    global.fetch = originalFetch;
  }
});

test('a fresh Shiprocket create claim stays locked while the first request is in flight', async () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const shipment = {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: orderId,
    provider: 'SHIPROCKET',
    provider_reference_id: '11111111111141118111',
    provider_shipment_id: null,
    status: 'CREATING',
    updated_at: new Date(),
  };
  let updateAttempts = 0;
  const prisma = {
    orders: { findUnique: async () => ({
      id: orderId,
      shipping_type: 'STANDARD',
      status: 'PROCESSING',
      payment_status: 'SUCCESS',
      payment_method: 'CARD',
    }) },
    shipments: {
      findUnique: async () => shipment,
      updateMany: async () => { updateAttempts += 1; return { count: 1 }; },
    },
  } as unknown as PrismaService;
  const service = new ShiprocketService(prisma, { get: () => undefined } as never);

  await assert.rejects(service.fulfillOrder(orderId), /still in progress/);
  assert.equal(updateAttempts, 0);
});

test('an ambiguous Shiprocket cancellation is reconciled before it can be retried', async () => {
  const shipment: Record<string, any> = {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: '11111111-1111-4111-8111-111111111111',
    provider: 'SHIPROCKET',
    provider_order_id: '88',
    provider_shipment_id: '99',
    tracking_number: 'AWB-123',
    status: 'AWB_ASSIGNED',
    updated_at: new Date(),
  };
  const trackingEvents: Record<string, unknown>[] = [];
  const shipments = {
    findUnique: async () => shipment,
    findUniqueOrThrow: async () => shipment,
    updateMany: async ({ where, data }: { where: Record<string, any>; data: Record<string, unknown> }) => {
      if (typeof where.status === 'string' && shipment.status !== where.status) return { count: 0 };
      if (where.status && typeof where.status === 'object' && where.status.in && !where.status.in.includes(shipment.status)) return { count: 0 };
      if ('tracking_number' in where && where.tracking_number !== shipment.tracking_number) return { count: 0 };
      Object.assign(shipment, data);
      return { count: 1 };
    },
  };
  const prisma = {
    shipments,
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      shipments,
      delivery_tracking_events: { createMany: async ({ data }: { data: Record<string, unknown>[] }) => { trackingEvents.push(...data); return { count: data.length }; } },
    }),
  } as unknown as PrismaService;
  const config = {
    get: (key: string) => ({
      SHIPROCKET_API_URL: 'https://shiprocket.test/v1/external',
      SHIPROCKET_EMAIL: 'api@example.test',
      SHIPROCKET_PASSWORD: 'secret',
    } as Record<string, string>)[key],
  };
  const originalFetch = global.fetch;
  const requests: string[] = [];
  let cancelRequestCount = 0;
  let providerCancellationConfirmed = false;
  global.fetch = (async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith('/orders/cancel/shipment/awbs')) {
      cancelRequestCount += 1;
      throw new TypeError('fetch failed');
    }
    const response = url.endsWith('/auth/login')
      ? { token: 'test-token' }
      : { data: {
          id: 88,
          status: providerCancellationConfirmed ? 'CANCELED' : 'PROCESSING',
          activities: providerCancellationConfirmed ? ['ORDER_CREATED', 'ORDER_CANCELLED'] : ['ORDER_CREATED'],
          shipments: { id: 99, status: providerCancellationConfirmed ? 'CANCELED' : 'PENDING' },
        } };
    return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const service = new ShiprocketService(prisma, config as never);
    await assert.rejects(service.cancelShipment(shipment.order_id), /may have been accepted/);
    assert.equal(shipment.status, 'CANCEL_UNCERTAIN');
    await assert.rejects(service.cancelShipment(shipment.order_id), /Wait briefly/);
    assert.equal(cancelRequestCount, 1);

    providerCancellationConfirmed = true;

    const result = await service.cancelShipment(shipment.order_id);

    assert.equal(result.status, 'CANCELLED');
    assert.equal(shipment.status, 'CANCELLED');
    assert.equal(cancelRequestCount, 1);
    assert.ok(requests.some((url) => url.endsWith('/orders/show/88')));
    assert.equal(trackingEvents.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('a cancellation claim refreshed by another worker stays locked during stale recovery', async () => {
  const shipment: Record<string, any> = {
    id: '22222222-2222-4222-8222-222222222222',
    order_id: '11111111-1111-4111-8111-111111111111',
    provider: 'SHIPROCKET',
    provider_order_id: '88',
    provider_shipment_id: '99',
    tracking_number: 'AWB-123',
    status: 'CANCELLING',
    updated_at: new Date(Date.now() - 5 * 60 * 1000),
  };
  const prisma = {
    shipments: {
      findUnique: async () => shipment,
      findUniqueOrThrow: async () => {
        shipment.updated_at = new Date();
        return shipment;
      },
      updateMany: async () => ({ count: 0 }),
    },
  } as unknown as PrismaService;
  const service = new ShiprocketService(prisma, { get: () => undefined } as never);

  await assert.rejects(service.cancelShipment(shipment.order_id), /already in progress/);
});
