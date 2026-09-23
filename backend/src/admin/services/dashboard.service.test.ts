import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminDashboardService } from './dashboard.service';
import { AdminOrdersService } from './orders.service';
import { AdminDashboardController } from '../controllers/dashboard.controller';
import { AppModule, PermissionAction, UserRole } from '../../common/constants';

test('dashboard commission and seller payout use successful non-terminal orders', async () => {
  const aggregateWhere: Array<Record<string, any>> = [];
  const countWhere: Array<Record<string, any>> = [];
  const prisma = {
    orders: {
      count: async ({ where }: { where: Record<string, any> }) => { countWhere.push(where); return 0; },
      aggregate: async ({ where }: { where: Record<string, any> }) => {
        aggregateWhere.push(where);
        return {
          _sum: {
            total_amount: 1250,
            commission_amount: 100,
            seller_payout: 1150,
          },
        };
      },
      findMany: async () => [],
    },
    products: { count: async () => 0 },
    seller_profiles: { count: async () => 0 },
  } as unknown as PrismaService;
  const orders = { listOrders: async () => ({ items: [] }) } as unknown as AdminOrdersService;

  const overview = await new AdminDashboardService(prisma, orders).getOverview({
    orders: true, products: true, sellers: true, canCreateSale: true, canReviewProducts: true,
  });

  assert.equal(overview.summary.platformCommissionThisMonth, 100);
  assert.equal(overview.summary.sellerPayoutsThisMonth, 1150);
  assert.equal(aggregateWhere[1].payment_status, 'SUCCESS');
  assert.deepEqual(aggregateWhere[1].status.notIn, ['CANCELLED', 'REFUNDED', 'RETURNED']);
  assert.deepEqual(aggregateWhere[2].seller_id, { not: null });
  assert.deepEqual(countWhere[1].status.in, ['PENDING', 'CONFIRMED', 'PROCESSING']);
  assert.deepEqual(countWhere[1].OR, [
    { payment_status: 'SUCCESS' },
    { payment_method: 'COD', payment_status: { notIn: ['FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'] } },
  ]);
});

test('dashboard only queries and returns metrics allowed by the caller permissions', async () => {
  let orderQueries = 0;
  let productQueries = 0;
  let sellerQueries = 0;
  let recentOrderQueries = 0;
  const prisma = {
    orders: {
      count: async () => { orderQueries += 1; return 0; },
      aggregate: async () => { orderQueries += 1; return { _sum: {} }; },
      findMany: async () => { orderQueries += 1; return []; },
    },
    products: { count: async () => { productQueries += 1; return 0; } },
    seller_profiles: { count: async () => { sellerQueries += 1; return 0; } },
  } as unknown as PrismaService;
  const orders = {
    listOrders: async () => { recentOrderQueries += 1; return { items: [] }; },
  } as unknown as AdminOrdersService;

  const overview = await new AdminDashboardService(prisma, orders).getOverview({
    orders: false, products: true, sellers: false, canCreateSale: false, canReviewProducts: true,
  });

  assert.equal(orderQueries, 0);
  assert.equal(recentOrderQueries, 0);
  assert.equal(productQueries, 2);
  assert.equal(sellerQueries, 0);
  assert.equal(overview.summary.grossSalesThisMonth, null);
  assert.equal(overview.summary.productsAwaitingApproval, 0);
  assert.equal(overview.summary.activeSellers, null);
  assert.deepEqual(overview.salesTrend, []);
  assert.deepEqual(overview.recentOrders, []);
  assert.equal(overview.visibility.canReviewProducts, true);
});

test('dashboard controller derives metric and action access from granular permissions', async () => {
  let receivedAccess: Record<string, boolean> | undefined;
  const dashboard = {
    getOverview: async (access: Record<string, boolean>) => {
      receivedAccess = access;
      return access;
    },
  } as unknown as AdminDashboardService;
  const rbac = {
    getUserPermissions: async () => [
      { module: AppModule.ORDERS, action: PermissionAction.VIEW, key: 'ORDERS:VIEW' },
      { module: AppModule.PRODUCTS, action: PermissionAction.EDIT, key: 'PRODUCTS:EDIT' },
      { module: AppModule.SELLERS, action: PermissionAction.VIEW, key: 'SELLERS:VIEW' },
    ],
  } as never;
  const controller = new AdminDashboardController(dashboard, rbac);

  await controller.getOverview({ sub: 'admin-id', role: UserRole.ADMIN });

  assert.deepEqual(receivedAccess, {
    orders: true,
    products: false,
    sellers: true,
    canCreateSale: false,
    canReviewProducts: false,
  });
});
