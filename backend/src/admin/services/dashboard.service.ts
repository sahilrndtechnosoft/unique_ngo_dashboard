import { Injectable } from '@nestjs/common';
import { order_status, payment_method, payment_status, Prisma, product_status, seller_status } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminOrdersService } from './orders.service';

const excludedOrderStatuses = [order_status.CANCELLED, order_status.REFUNDED, order_status.RETURNED];

export interface DashboardAccess {
  orders: boolean;
  products: boolean;
  sellers: boolean;
  canCreateSale: boolean;
  canReviewProducts: boolean;
}

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: AdminOrdersService,
  ) {}

  async getOverview(access: DashboardAccess) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
    const paidOrders: Prisma.ordersWhereInput = {
      payment_status: payment_status.SUCCESS,
      status: { notIn: excludedOrderStatuses },
    };

    const [orderMetrics, productMetrics, activeSellers] = await Promise.all([
      access.orders
        ? Promise.all([
            this.prisma.orders.count({ where: { created_at: { gte: monthStart }, status: { notIn: excludedOrderStatuses } } }),
            this.prisma.orders.count({
              where: {
                status: { in: [order_status.PENDING, order_status.CONFIRMED, order_status.PROCESSING] },
                OR: [
                  { payment_status: payment_status.SUCCESS },
                  {
                    payment_method: payment_method.COD,
                    payment_status: { notIn: [payment_status.FAILED, payment_status.CANCELLED, payment_status.REFUNDED, payment_status.PARTIALLY_REFUNDED] },
                  },
                ],
              },
            }),
            this.prisma.orders.aggregate({ where: { ...paidOrders, created_at: { gte: monthStart } }, _sum: { total_amount: true } }),
            this.prisma.orders.aggregate({ where: { ...paidOrders, created_at: { gte: monthStart } }, _sum: { commission_amount: true } }),
            this.prisma.orders.aggregate({ where: { ...paidOrders, seller_id: { not: null }, created_at: { gte: monthStart } }, _sum: { seller_payout: true } }),
            this.prisma.orders.aggregate({ where: { ...paidOrders, created_at: { gte: previousMonthStart, lt: monthStart } }, _sum: { total_amount: true } }),
            this.prisma.orders.findMany({
              where: { ...paidOrders, created_at: { gte: trendStart } },
              select: { created_at: true, total_amount: true },
              orderBy: { created_at: 'asc' },
            }),
            this.ordersService.listOrders({ page: 1, limit: 6 }),
          ])
        : Promise.resolve(null),
      access.products
        ? Promise.all([
            this.prisma.products.count({ where: { status: product_status.PENDING_REVIEW, deleted_at: null } }),
            this.prisma.products.count({ where: { status: product_status.ACTIVE, deleted_at: null } }),
          ])
        : Promise.resolve(null),
      access.sellers
        ? this.prisma.seller_profiles.count({ where: { status: seller_status.ACTIVE, deleted_at: null } })
        : Promise.resolve(null),
    ]);

    const [ordersThisMonth, pendingFulfillment, currentSales, currentCommission, currentSellerPayout, previousSales, trendOrders, recentOrders] = orderMetrics ?? [];
    const [productsAwaitingApproval, activeProducts] = productMetrics ?? [];

    const byDay = new Map<string, { orders: number; revenue: number }>();
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(trendStart);
      day.setUTCDate(day.getUTCDate() + offset);
      byDay.set(day.toISOString().slice(0, 10), { orders: 0, revenue: 0 });
    }
    for (const order of trendOrders ?? []) {
      const day = order.created_at.toISOString().slice(0, 10);
      const point = byDay.get(day);
      if (point) {
        point.orders += 1;
        point.revenue += Number(order.total_amount);
      }
    }

    const grossSales = Number(currentSales?._sum.total_amount ?? 0);
    const previousGrossSales = Number(previousSales?._sum.total_amount ?? 0);
    return {
      summary: {
        ordersThisMonth: ordersThisMonth ?? null,
        grossSalesThisMonth: currentSales ? grossSales : null,
        platformCommissionThisMonth: currentCommission ? Number(currentCommission._sum.commission_amount ?? 0) : null,
        sellerPayoutsThisMonth: currentSellerPayout ? Number(currentSellerPayout._sum.seller_payout ?? 0) : null,
        grossSalesChange: previousSales && previousGrossSales > 0
          ? Number(((grossSales - previousGrossSales) / previousGrossSales * 100).toFixed(1))
          : null,
        awaitingFulfillment: pendingFulfillment ?? null,
        productsAwaitingApproval: productsAwaitingApproval ?? null,
        activeProducts: activeProducts ?? null,
        activeSellers: activeSellers ?? null,
      },
      visibility: access,
      salesTrend: access.orders ? [...byDay].map(([date, totals]) => ({ date, ...totals })) : [],
      recentOrders: recentOrders?.items ?? [],
    };
  }
}
