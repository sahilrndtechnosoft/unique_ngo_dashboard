import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { payment_method, payment_status, Prisma, shipping_type } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

test('admin counter sale persists resolved commission and seller payout snapshots', async () => {
  const productId = 'product-id';
  const sellerId = 'seller-id';
  const orderId = 'order-id';
  let orderData: any;
  let itemRows: any[] = [];
  let stockWhere: Record<string, unknown> | undefined;
  const product = {
    id: productId,
    name: 'Marketplace item',
    category_id: 'category-id',
    seller_id: sellerId,
    status: 'ACTIVE',
    price: new Prisma.Decimal(100),
    commission_rate: null,
    is_taxable: true,
    tax_rate: new Prisma.Decimal(5),
    stock_quantity: 10,
    sku: 'SKU-1',
    weight_grams: null,
    length_cm: null,
    width_cm: null,
    height_cm: null,
    is_returnable: true,
    return_days: 7,
  };
  const tx = {
    $queryRaw: async () => [{ id: sellerId }],
    products: { updateMany: async ({ where }: { where: Record<string, unknown> }) => { stockWhere = where; return { count: 1 }; } },
    orders: {
      create: async ({ data }: any) => {
        orderData = data;
        return { ...data, id: orderId, order_number: data.order_number };
      },
    },
    order_items: { createMany: async ({ data }: any) => { itemRows = data; } },
    product_inventory_logs: { createMany: async () => undefined },
    shipments: { create: async () => undefined },
  };
  const prisma = {
    products: { findMany: async () => [product] },
    product_variants: { findMany: async () => [] },
    product_images: { findMany: async () => [] },
    product_categories: { findMany: async () => [{ id: 'category-id', commission_rate: new Prisma.Decimal(15) }] },
    seller_profiles: { findMany: async () => [{ id: sellerId, status: 'ACTIVE', commission_rate: new Prisma.Decimal(25) }] },
    commission_settings: { findFirst: async () => ({ rate: new Prisma.Decimal(10) }) },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new OrdersService(prisma, {} as any, {} as any);

  await service.createAdminSale({
    buyerName: 'Counter buyer',
    buyerMobile: '9000000000',
    shippingType: shipping_type.PICKUP,
    paymentMethod: payment_method.CASH,
    paymentStatus: payment_status.SUCCESS,
    items: [{ productId, quantity: 2 }],
  }, 'admin-id');

  assert.equal(orderData.commission_rate.toNumber(), 15);
  assert.equal(orderData.commission_amount.toNumber(), 30);
  assert.equal(orderData.seller_payout.toNumber(), 180);
  assert.equal(orderData.total_amount.toNumber(), 210);
  assert.equal(itemRows.length, 1);
  assert.equal(itemRows[0].commission_rate.toNumber(), 15);
  assert.equal(itemRows[0].commission_amount.toNumber(), 30);
  assert.equal(itemRows[0].seller_payout.toNumber(), 180);
  assert.equal(itemRows[0].total_price.toNumber(), 210);
  assert.equal(itemRows[0].seller_id, sellerId);
  assert.equal(stockWhere?.price, product.price);

  await service.createAdminSale({
    source: 'ADMIN_PHONE',
    buyerName: 'Phone buyer',
    buyerMobile: '9000000001',
    shippingType: shipping_type.STANDARD,
    shippingFee: 25,
    shippingAddress: {
      fullName: 'Phone buyer',
      mobile: '9000000001',
      addressLine1: '12 Main Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
    },
    paymentMethod: payment_method.CASH,
    paymentStatus: payment_status.SUCCESS,
    items: [{ productId, quantity: 2 }],
  }, 'admin-id');

  assert.equal(orderData.shipping_fee.toNumber(), 25);
  assert.equal(orderData.total_amount.toNumber(), 235);
  assert.equal(orderData.seller_payout.toNumber(), 180);
  assert.equal(itemRows[0].commission_amount.toNumber(), 30);

  await assert.rejects(service.createAdminSale({
    buyerName: 'Counter buyer',
    buyerMobile: '9000000000',
    shippingType: shipping_type.PICKUP,
    shippingFee: 1,
    paymentMethod: payment_method.CASH,
    items: [{ productId, quantity: 1 }],
  }, 'admin-id'), BadRequestException);
});

test('admin sale allocates one delivery fee across seller orders without duplicating it', async () => {
  const products = [
    { id: 'product-a', seller_id: 'seller-a', name: 'Seller A item', price: new Prisma.Decimal(100) },
    { id: 'product-b', seller_id: 'seller-b', name: 'Seller B item', price: new Prisma.Decimal(300) },
  ].map((product) => ({
    ...product, category_id: 'category-id', status: 'ACTIVE', deleted_at: null,
    commission_rate: null, is_taxable: false, tax_rate: new Prisma.Decimal(0), stock_quantity: 5,
  }));
  const orders: any[] = [];
  const tx = {
    $queryRaw: async () => [{ id: 'locked' }],
    products: { updateMany: async () => ({ count: 1 }) },
    orders: { create: async ({ data }: any) => {
      const order = { ...data, id: `order-${data.seller_id}` };
      orders.push(order);
      return order;
    } },
    order_items: { createMany: async () => undefined },
    product_inventory_logs: { createMany: async () => undefined },
    shipments: { create: async () => undefined },
  };
  const prisma = {
    products: { findMany: async () => products },
    product_variants: { findMany: async () => [] },
    product_images: { findMany: async () => [] },
    product_categories: { findMany: async () => [] },
    seller_profiles: { findMany: async () => [
      { id: 'seller-a', status: 'ACTIVE', commission_rate: null },
      { id: 'seller-b', status: 'ACTIVE', commission_rate: null },
    ] },
    commission_settings: { findFirst: async () => null },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new OrdersService(prisma, {} as any, {} as any);

  await service.createAdminSale({
    source: 'ADMIN_PHONE', buyerName: 'Phone buyer', buyerMobile: '9000000000',
    shippingType: shipping_type.STANDARD, shippingFee: 10,
    shippingAddress: {
      fullName: 'Phone buyer', mobile: '9000000000', addressLine1: '1 Main Street',
      city: 'Mumbai', state: 'Maharashtra', postalCode: '400001',
    },
    paymentMethod: payment_method.CASH,
    items: [{ productId: 'product-a', quantity: 1 }, { productId: 'product-b', quantity: 1 }],
  }, 'admin-id');

  assert.deepEqual(orders.map((order) => [order.shipping_fee.toNumber(), order.total_amount.toNumber()]), [
    [2.5, 102.5],
    [7.5, 307.5],
  ]);
  assert.equal(orders.reduce((total, order) => total + order.shipping_fee.toNumber(), 0), 10);
});

test('checkout allocates a cart coupon across seller orders before commission and payout snapshots', async () => {
  const cart = { id: 'cart-id' };
  const products = [
    {
      id: 'product-a', name: 'Category-rate item', category_id: 'category-a', seller_id: 'seller-a',
      price: new Prisma.Decimal(100), commission_rate: null,
    },
    {
      id: 'product-b', name: 'Product-rate item', category_id: 'category-b', seller_id: 'seller-b',
      price: new Prisma.Decimal(200), commission_rate: new Prisma.Decimal(20),
    },
  ].map((product) => ({
    ...product, deleted_at: null, status: 'ACTIVE', is_taxable: true, tax_rate: new Prisma.Decimal(5),
    stock_quantity: 5, sku: null, weight_grams: null, length_cm: null, width_cm: null, height_cm: null,
    is_returnable: true, return_days: 7,
  }));
  const cartItems = products.map((product, index) => ({
    id: `cart-item-${index + 1}`, cart_id: cart.id, product_id: product.id, variant_id: null, quantity: 1,
  }));
  const orderRows: any[] = [];
  const itemRows: any[] = [];
  const usageRows: any[] = [];
  const coupon = {
    id: 'coupon-id', is_active: true, starts_at: new Date(0), expires_at: null,
    usage_limit: null, used_count: 0, per_user_limit: 5, applicable_to: 'PRODUCTS',
    discount_type: 'FLAT', discount_value: new Prisma.Decimal(30),
    max_discount: null, min_order_value: new Prisma.Decimal(0),
  };
  const tx = {
    cart_items: { deleteMany: async () => ({ count: cartItems.length }) },
    $queryRaw: async () => [{ id: 'locked' }],
    coupons: {
      findUnique: async () => coupon,
      update: async () => undefined,
    },
    coupon_usages: {
      count: async () => 0,
      create: async ({ data }: any) => usageRows.push(data),
    },
    products: { updateMany: async () => ({ count: 1 }) },
    orders: {
      create: async ({ data }: any) => {
        const order = { ...data, id: `order-${data.seller_id}`, order_number: `ORD-${orderRows.length + 1}` };
        orderRows.push(order);
        return order;
      },
    },
    order_items: { createMany: async ({ data }: any) => itemRows.push(...data) },
    product_inventory_logs: { createMany: async () => undefined },
    shipments: { create: async () => undefined },
  };
  const prisma = {
    carts: { findUnique: async () => cart },
    cart_items: { findMany: async () => cartItems },
    products: { findMany: async () => products },
    product_categories: { findMany: async () => [
      { id: 'category-a', commission_rate: new Prisma.Decimal(10) },
      { id: 'category-b', commission_rate: new Prisma.Decimal(12) },
    ] },
    seller_profiles: { findMany: async () => [
      { id: 'seller-a', status: 'ACTIVE', commission_rate: new Prisma.Decimal(15) },
      { id: 'seller-b', status: 'ACTIVE', commission_rate: new Prisma.Decimal(8) },
    ] },
    commission_settings: { findFirst: async () => ({ rate: new Prisma.Decimal(5) }) },
    product_variants: { findMany: async () => [] },
    product_images: { findMany: async () => [] },
    orders: { findFirst: async ({ where }: any) => orderRows.find((order) => order.id === where.id) },
    order_items: { findMany: async ({ where }: any) => itemRows.filter((item) => item.order_id === where.order_id) },
    shipments: { findUnique: async () => null },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const addresses = {
    ensureOwnedAddress: async () => ({
      full_name: 'Buyer', mobile: '9000000000', address_line1: '1 Main Street', address_line2: null,
      city: 'Mumbai', state: 'Maharashtra', postal_code: '400001', country: 'India',
    }),
  };
  const coupons = {
    validateForOrder: async () => ({ couponId: coupon.id, discount: new Prisma.Decimal(30) }),
  };
  const service = new OrdersService(prisma, addresses as any, coupons as any);

  await service.checkout('buyer-id', {
    shippingAddressId: 'address-id',
    paymentMethod: payment_method.CARD,
    couponCode: 'SAVE30',
  });

  assert.deepEqual(orderRows.map((order) => [
    order.seller_id, order.discount_amount.toNumber(), order.tax_amount.toNumber(),
    order.commission_rate.toNumber(), order.commission_amount.toNumber(),
    order.seller_payout.toNumber(), order.total_amount.toNumber(),
  ]), [
    ['seller-a', 10, 4.5, 10, 9, 85.5, 94.5],
    ['seller-b', 20, 9, 20, 36, 153, 189],
  ]);
  assert.deepEqual(itemRows.map((item) => [
    item.discount_amount.toNumber(), item.tax_amount.toNumber(), item.commission_rate.toNumber(),
    item.commission_amount.toNumber(), item.seller_payout.toNumber(), item.total_price.toNumber(),
  ]), [
    [10, 4.5, 10, 9, 85.5, 94.5],
    [20, 9, 20, 36, 153, 189],
  ]);
  assert.equal(usageRows[0].discount.toNumber(), 30);
  assert.equal(usageRows[0].order_id, 'order-seller-a');
});

test('checkout rechecks the coupon usage limit under lock before reserving stock', async () => {
  const cart = { id: 'cart-id' };
  const cartItem = { id: 'cart-item-id', cart_id: cart.id, product_id: 'product-id', variant_id: null, quantity: 1 };
  const product = {
    id: cartItem.product_id, name: 'Available item', category_id: 'category-id', seller_id: null,
    deleted_at: null, status: 'ACTIVE', price: new Prisma.Decimal(100), commission_rate: null,
    is_taxable: false, tax_rate: new Prisma.Decimal(0),
  };
  const coupon = {
    id: 'coupon-id', is_active: true, starts_at: new Date(0), expires_at: null,
    usage_limit: 1, used_count: 1, per_user_limit: 1, applicable_to: 'PRODUCTS',
    discount_type: 'FLAT', discount_value: new Prisma.Decimal(10),
    max_discount: null, min_order_value: new Prisma.Decimal(0),
  };
  let stockReservations = 0;
  let orderWrites = 0;
  const tx = {
    cart_items: { deleteMany: async () => ({ count: 1 }) },
    $queryRaw: async () => [],
    coupons: { findUnique: async () => coupon },
    coupon_usages: { count: async () => 0 },
    products: { updateMany: async () => { stockReservations += 1; return { count: 1 }; } },
    orders: { create: async () => { orderWrites += 1; } },
  };
  const prisma = {
    carts: { findUnique: async () => cart },
    cart_items: { findMany: async () => [cartItem] },
    products: { findMany: async () => [product] },
    product_categories: { findMany: async () => [] },
    seller_profiles: { findMany: async () => [] },
    commission_settings: { findFirst: async () => null },
    product_variants: { findMany: async () => [] },
    product_images: { findMany: async () => [] },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const coupons = { validateForOrder: async () => ({ couponId: coupon.id, discount: new Prisma.Decimal(10) }) };
  const addresses = { ensureOwnedAddress: async () => ({
    full_name: 'Buyer', mobile: '9000000000', address_line1: '1 Main Street', address_line2: null,
    city: 'Mumbai', state: 'Maharashtra', postal_code: '400001', country: 'India',
  }) };
  const service = new OrdersService(prisma, addresses as any, coupons as any);

  await assert.rejects(service.checkout('buyer-id', {
    shippingAddressId: 'address-id', paymentMethod: payment_method.CARD, couponCode: 'LIMITED',
  }), /usage limit has been reached/);
  assert.equal(stockReservations, 0);
  assert.equal(orderWrites, 0);
});

test('admin sales do not reserve a variant after its parent product is deactivated', async () => {
  const productId = 'product-id';
  const variantId = 'variant-id';
  let productIsActive = false;
  let variantReservations = 0;
  let orderWrites = 0;
  const product = {
    id: productId,
    name: 'Inactive variant parent',
    category_id: 'category-id',
    seller_id: null,
    status: 'ACTIVE',
    deleted_at: null,
    price: new Prisma.Decimal(100),
    commission_rate: null,
    is_taxable: false,
    tax_rate: new Prisma.Decimal(0),
  };
  const tx = {
    $queryRaw: async () => productIsActive ? [{ id: productId }] : [],
    product_variants: { updateMany: async () => { variantReservations += 1; return { count: 1 }; } },
    orders: { create: async () => { orderWrites += 1; } },
  };
  const prisma = {
    products: { findMany: async () => [product] },
    product_variants: { findMany: async () => [{
      id: variantId, product_id: productId, name: 'Variant', price: new Prisma.Decimal(100),
      is_active: true, stock_quantity: 5,
    }] },
    product_images: { findMany: async () => [] },
    product_categories: { findMany: async () => [] },
    seller_profiles: { findMany: async () => [] },
    commission_settings: { findFirst: async () => null },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new OrdersService(prisma, {} as any, {} as any);

  await assert.rejects(service.createAdminSale({
    buyerName: 'Counter buyer',
    buyerMobile: '9000000000',
    shippingType: shipping_type.PICKUP,
    paymentMethod: payment_method.CASH,
    items: [{ productId, variantId, quantity: 1 }],
  }, 'admin-id'), ConflictException);
  assert.equal(variantReservations, 0);
  assert.equal(orderWrites, 0);
});

test('admin sale acquires seller locks in a stable order regardless of item order', async () => {
  const products = [
    { id: 'product-a', seller_id: 'seller-a', name: 'Seller A item' },
    { id: 'product-b', seller_id: 'seller-b', name: 'Seller B item' },
  ].map((product) => ({
    ...product,
    category_id: 'category-id',
    status: 'ACTIVE',
    deleted_at: null,
    price: new Prisma.Decimal(100),
    commission_rate: null,
    is_taxable: false,
    tax_rate: new Prisma.Decimal(0),
    stock_quantity: 5,
  }));
  const sellerLocks: string[] = [];
  const tx = {
    $queryRaw: async (_query: TemplateStringsArray, ...values: unknown[]) => {
      sellerLocks.push(String(values[0]));
      return [{ id: String(values[0]) }];
    },
    products: { updateMany: async () => ({ count: 1 }) },
    orders: { create: async ({ data }: any) => ({ ...data, id: `order-${data.seller_id}` }) },
    order_items: { createMany: async () => undefined },
    product_inventory_logs: { createMany: async () => undefined },
  };
  const prisma = {
    products: { findMany: async () => products },
    product_variants: { findMany: async () => [] },
    product_images: { findMany: async () => [] },
    product_categories: { findMany: async () => [] },
    seller_profiles: { findMany: async () => [
      { id: 'seller-a', status: 'ACTIVE', commission_rate: null },
      { id: 'seller-b', status: 'ACTIVE', commission_rate: null },
    ] },
    commission_settings: { findFirst: async () => null },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new OrdersService(prisma, {} as any, {} as any);

  await service.createAdminSale({
    buyerName: 'Counter buyer',
    buyerMobile: '9000000000',
    shippingType: shipping_type.PICKUP,
    paymentMethod: payment_method.CASH,
    items: [
      { productId: 'product-b', quantity: 1 },
      { productId: 'product-a', quantity: 1 },
    ],
  }, 'admin-id');

  assert.deepEqual(sellerLocks, ['seller-a', 'seller-b']);
});

test('admin sales do not reserve stock after a seller is deactivated', async () => {
  let stockReservations = 0;
  let orderWrites = 0;
  const tx = {
    $queryRaw: async () => [],
    products: { updateMany: async () => { stockReservations += 1; return { count: 1 }; } },
    orders: { create: async () => { orderWrites += 1; } },
  };
  const prisma = {
    products: { findMany: async () => [{
      id: 'product-id', name: 'Suspended seller item', category_id: 'category-id', seller_id: 'seller-id',
      status: 'ACTIVE', deleted_at: null, price: new Prisma.Decimal(100), commission_rate: null,
      is_taxable: false, tax_rate: new Prisma.Decimal(0), stock_quantity: 5,
    }] },
    product_variants: { findMany: async () => [] },
    product_images: { findMany: async () => [] },
    product_categories: { findMany: async () => [] },
    seller_profiles: { findMany: async () => [{ id: 'seller-id', status: 'ACTIVE', commission_rate: null }] },
    commission_settings: { findFirst: async () => null },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new OrdersService(prisma, {} as any, {} as any);

  await assert.rejects(service.createAdminSale({
    buyerName: 'Counter buyer',
    buyerMobile: '9000000000',
    shippingType: shipping_type.PICKUP,
    paymentMethod: payment_method.CASH,
    items: [{ productId: 'product-id', quantity: 1 }],
  }, 'admin-id'), ConflictException);
  assert.equal(stockReservations, 0);
  assert.equal(orderWrites, 0);
});

test('checkout rejects a cart already claimed by another checkout', async () => {
  let orderWrites = 0;
  const cart = { id: 'cart-id' };
  const cartItem = {
    id: 'cart-item-id',
    cart_id: cart.id,
    product_id: 'product-id',
    variant_id: null,
    quantity: 1,
  };
  const product = {
    id: cartItem.product_id,
    name: 'Available item',
    category_id: 'category-id',
    seller_id: null,
    deleted_at: null,
    status: 'ACTIVE',
    price: new Prisma.Decimal(100),
    commission_rate: null,
    is_taxable: false,
    tax_rate: new Prisma.Decimal(0),
  };
  const tx = {
    cart_items: { deleteMany: async () => ({ count: 0 }) },
    orders: { create: async () => { orderWrites += 1; } },
  };
  const prisma = {
    carts: { findUnique: async () => cart },
    cart_items: { findMany: async () => [cartItem] },
    products: { findMany: async () => [product] },
    product_categories: { findMany: async () => [] },
    seller_profiles: { findMany: async () => [] },
    commission_settings: { findFirst: async () => null },
    product_variants: { findMany: async () => [] },
    product_images: { findMany: async () => [] },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const addresses = {
    ensureOwnedAddress: async () => ({
      full_name: 'Buyer',
      mobile: '9000000000',
      address_line1: '1 Main Street',
      address_line2: null,
      city: 'Mumbai',
      state: 'Maharashtra',
      postal_code: '400001',
      country: 'India',
    }),
  };
  const service = new OrdersService(prisma, addresses as any, {} as any);

  await assert.rejects(
    service.checkout('buyer-id', {
      shippingAddressId: 'address-id',
      paymentMethod: payment_method.CARD,
    }),
    ConflictException,
  );
  assert.equal(orderWrites, 0);
});

test('checkout does not place an order when the product price changed before stock reservation', async () => {
  const price = new Prisma.Decimal(100);
  let orderWrites = 0;
  let reservedPrice: Prisma.Decimal | undefined;
  const cart = { id: 'cart-id' };
  const cartItem = {
    id: 'cart-item-id',
    cart_id: cart.id,
    product_id: 'product-id',
    variant_id: null,
    quantity: 1,
  };
  const product = {
    id: cartItem.product_id,
    name: 'Price changed item',
    category_id: 'category-id',
    seller_id: null,
    deleted_at: null,
    status: 'ACTIVE',
    price,
    commission_rate: null,
    is_taxable: false,
    tax_rate: new Prisma.Decimal(0),
  };
  const tx = {
    cart_items: { deleteMany: async () => ({ count: 1 }) },
    products: {
      updateMany: async ({ where }: { where: { price: Prisma.Decimal } }) => {
        reservedPrice = where.price;
        return { count: 0 };
      },
    },
    orders: { create: async () => { orderWrites += 1; } },
  };
  const prisma = {
    carts: { findUnique: async () => cart },
    cart_items: { findMany: async () => [cartItem] },
    products: { findMany: async () => [product] },
    product_categories: { findMany: async () => [] },
    seller_profiles: { findMany: async () => [] },
    commission_settings: { findFirst: async () => null },
    product_variants: { findMany: async () => [] },
    product_images: { findMany: async () => [] },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const addresses = {
    ensureOwnedAddress: async () => ({
      full_name: 'Buyer', mobile: '9000000000', address_line1: '1 Main Street',
      address_line2: null, city: 'Mumbai', state: 'Maharashtra', postal_code: '400001', country: 'India',
    }),
  };
  const service = new OrdersService(prisma, addresses as any, {} as any);

  await assert.rejects(
    service.checkout('buyer-id', {
      shippingAddressId: 'address-id',
      paymentMethod: payment_method.CARD,
    }),
    ConflictException,
  );
  assert.equal(reservedPrice, price);
  assert.equal(orderWrites, 0);
});

test('checkout does not reserve a variant when its parent product is no longer active', async () => {
  const productId = 'product-id';
  const variantId = 'variant-id';
  const cart = { id: 'cart-id' };
  const cartItem = { id: 'cart-item-id', cart_id: cart.id, product_id: productId, variant_id: variantId, quantity: 1 };
  let variantReservations = 0;
  let orderWrites = 0;
  const tx = {
    cart_items: { deleteMany: async () => ({ count: 1 }) },
    $queryRaw: async () => [],
    product_variants: { updateMany: async () => { variantReservations += 1; return { count: 1 }; } },
    orders: { create: async () => { orderWrites += 1; } },
  };
  const prisma = {
    carts: { findUnique: async () => cart },
    cart_items: { findMany: async () => [cartItem] },
    products: { findMany: async () => [{
      id: productId, name: 'Deactivated product', category_id: 'category-id', seller_id: null,
      deleted_at: null, status: 'ACTIVE', price: new Prisma.Decimal(100), commission_rate: null,
      is_taxable: false, tax_rate: new Prisma.Decimal(0),
    }] },
    product_categories: { findMany: async () => [] },
    seller_profiles: { findMany: async () => [] },
    commission_settings: { findFirst: async () => null },
    product_variants: { findMany: async () => [{
      id: variantId, product_id: productId, name: 'Variant', price: new Prisma.Decimal(100),
      is_active: true, stock_quantity: 5,
    }] },
    product_images: { findMany: async () => [] },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const addresses = {
    ensureOwnedAddress: async () => ({
      full_name: 'Buyer', mobile: '9000000000', address_line1: '1 Main Street',
      address_line2: null, city: 'Mumbai', state: 'Maharashtra', postal_code: '400001', country: 'India',
    }),
  };
  const service = new OrdersService(prisma, addresses as any, {} as any);

  await assert.rejects(service.checkout('buyer-id', {
    shippingAddressId: 'address-id',
    paymentMethod: payment_method.CARD,
  }), ConflictException);
  assert.equal(variantReservations, 0);
  assert.equal(orderWrites, 0);
});

test('checkout does not reserve stock after a seller is deactivated', async () => {
  const cart = { id: 'cart-id' };
  const productId = 'product-id';
  let stockReservations = 0;
  let orderWrites = 0;
  const tx = {
    cart_items: { deleteMany: async () => ({ count: 1 }) },
    $queryRaw: async () => [],
    products: { updateMany: async () => { stockReservations += 1; return { count: 1 }; } },
    orders: { create: async () => { orderWrites += 1; } },
  };
  const prisma = {
    carts: { findUnique: async () => cart },
    cart_items: { findMany: async () => [{
      id: 'cart-item-id', cart_id: cart.id, product_id: productId, variant_id: null, quantity: 1,
    }] },
    products: { findMany: async () => [{
      id: productId, name: 'Suspended seller item', category_id: 'category-id', seller_id: 'seller-id',
      deleted_at: null, status: 'ACTIVE', price: new Prisma.Decimal(100), commission_rate: null,
      is_taxable: false, tax_rate: new Prisma.Decimal(0),
    }] },
    product_categories: { findMany: async () => [] },
    seller_profiles: { findMany: async () => [{ id: 'seller-id', status: 'ACTIVE', commission_rate: null }] },
    commission_settings: { findFirst: async () => null },
    product_variants: { findMany: async () => [] },
    product_images: { findMany: async () => [] },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const addresses = {
    ensureOwnedAddress: async () => ({
      full_name: 'Buyer', mobile: '9000000000', address_line1: '1 Main Street',
      address_line2: null, city: 'Mumbai', state: 'Maharashtra', postal_code: '400001', country: 'India',
    }),
  };
  const service = new OrdersService(prisma, addresses as any, {} as any);

  await assert.rejects(service.checkout('buyer-id', {
    shippingAddressId: 'address-id',
    paymentMethod: payment_method.CARD,
  }), ConflictException);
  assert.equal(stockReservations, 0);
  assert.equal(orderWrites, 0);
});
