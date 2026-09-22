import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaService } from '../../prisma/prisma.service';
import { order_status, payment_status, shipping_type } from '../../../generated/prisma/client';
import { AdminOrdersService } from './orders.service';

test('delivery orders need an assigned Shiprocket AWB before manual shipped status', async () => {
  const tx = {
    orders: { findUnique: async () => ({ status: order_status.PROCESSING, shipping_type: shipping_type.STANDARD }) },
    shipments: { findUnique: async () => ({ provider: 'SHIPROCKET', tracking_number: null, status: 'AWB_ASSIGNING' }) },
  };
  const prisma = { $transaction: async (callback: (transaction: any) => Promise<unknown>) => callback(tx) } as unknown as PrismaService;
  const service = new AdminOrdersService(prisma);

  await assert.rejects(
    service.updateStatus('order-id', { status: order_status.SHIPPED }, 'admin-id'),
    /assign its AWB/,
  );
});

test('Shiprocket delivery orders cannot be manually marked delivered before provider confirmation', async () => {
  let orderWrites = 0;
  const tx = {
    orders: {
      findUnique: async () => ({ status: order_status.SHIPPED, shipping_type: shipping_type.STANDARD }),
      updateMany: async () => { orderWrites += 1; return { count: 1 }; },
    },
    shipments: {
      findUnique: async () => ({ provider: 'SHIPROCKET', status: 'IN TRANSIT', tracking_number: 'AWB-123' }),
    },
  };
  const prisma = { $transaction: async (callback: (transaction: any) => Promise<unknown>) => callback(tx) } as unknown as PrismaService;
  const service = new AdminOrdersService(prisma);

  await assert.rejects(
    service.updateStatus('order-id', { status: order_status.DELIVERED }, 'admin-id'),
    /Wait for Shiprocket to confirm delivery/,
  );
  assert.equal(orderWrites, 0);
});

test('counter pickup orders cannot be manually marked shipped', async () => {
  const tx = {
    orders: { findUnique: async () => ({ status: order_status.PROCESSING, shipping_type: shipping_type.PICKUP }) },
    shipments: { findUnique: async () => null },
  };
  const prisma = { $transaction: async (callback: (transaction: any) => Promise<unknown>) => callback(tx) } as unknown as PrismaService;
  const service = new AdminOrdersService(prisma);

  await assert.rejects(
    service.updateStatus('order-id', { status: order_status.SHIPPED }, 'admin-id'),
    /counter pickup as delivered/,
  );
});

test('refunding an order also updates its payment status', async () => {
  const order = {
    id: 'order-id',
    status: order_status.DELIVERED,
    shipping_type: shipping_type.STANDARD,
    payment_status: payment_status.SUCCESS,
    buyer_id: null,
    seller_id: null,
    shipping_address_id: null,
  } as any;
  let updateData: Record<string, unknown> | undefined;
  const tx = {
    orders: {
      findUnique: async () => order,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { count: 1 };
      },
    },
    shipments: { findUnique: async () => null },
  };
  const prisma = {
    $transaction: async (callback: (transaction: any) => Promise<unknown>) => callback(tx),
    orders: { findFirst: async () => ({ ...order, ...updateData }) },
    order_items: { findMany: async () => [] },
    users: { findUnique: async () => null },
    seller_profiles: { findUnique: async () => null },
    user_addresses: { findUnique: async () => null },
    shipments: { findUnique: async () => null },
  } as unknown as PrismaService;
  const service = new AdminOrdersService(prisma);

  await service.updateStatus('order-id', { status: order_status.REFUNDED }, 'admin-id');

  assert.equal(updateData?.payment_status, payment_status.REFUNDED);
});
