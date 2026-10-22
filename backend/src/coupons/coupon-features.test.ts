import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coupon_usage_status, Prisma } from '../../generated/prisma/client';
import { CouponsService } from './services/coupons.service';

test('validateCouponForCart calculates flat discount correctly and returns positive discount and new total', async () => {
  const coupon = {
    id: 'c-1',
    code: 'FLAT50',
    discount_type: 'FLAT',
    discount_value: new Prisma.Decimal(50),
    min_order_value: new Prisma.Decimal(200),
    max_discount: null,
    usage_limit: 100,
    used_count: 5,
    per_user_limit: 1,
    is_active: true,
    partner_store_id: null,
    free_shipping: false,
    stacking_allowed: false,
    starts_at: new Date('2026-01-01'),
    expires_at: null,
  };

  const mockPrisma: any = {
    coupons: { findUnique: async () => coupon },
    coupon_usages: { count: async () => 0 },
  };

  const service = new CouponsService(mockPrisma);
  const result = await service.validateCouponForCart(
    { code: 'FLAT50', orderTotal: 300 },
    'user-1',
  );

  assert.equal(result.valid, true);
  assert.equal(result.discountAmount, 50);
  assert.equal(result.newTotal, 250);
});

test('validateCouponForCart calculates percentage discount with max cap', async () => {
  const coupon = {
    id: 'c-2',
    code: 'PERCENT20',
    discount_type: 'PERCENTAGE',
    discount_value: new Prisma.Decimal(20),
    min_order_value: new Prisma.Decimal(100),
    max_discount: new Prisma.Decimal(60), // Cap at ₹60
    usage_limit: null,
    used_count: 0,
    per_user_limit: 2,
    is_active: true,
    partner_store_id: null,
    free_shipping: false,
    stacking_allowed: false,
    starts_at: new Date('2026-01-01'),
    expires_at: null,
  };

  const mockPrisma: any = {
    coupons: { findUnique: async () => coupon },
    coupon_usages: { count: async () => 0 },
  };

  const service = new CouponsService(mockPrisma);
  // 20% of 500 = 100, but capped at 60
  const result = await service.validateCouponForCart(
    { code: 'PERCENT20', orderTotal: 500 },
    'user-1',
  );

  assert.equal(result.valid, true);
  assert.equal(result.discountAmount, 60);
  assert.equal(result.newTotal, 440);
});

test('validateCouponForCart rejects when order is below minOrderValue', async () => {
  const coupon = {
    id: 'c-3',
    code: 'MIN500',
    discount_type: 'FLAT',
    discount_value: new Prisma.Decimal(100),
    min_order_value: new Prisma.Decimal(500),
    usage_limit: null,
    used_count: 0,
    per_user_limit: 1,
    is_active: true,
    starts_at: new Date('2026-01-01'),
    expires_at: null,
  };

  const mockPrisma: any = {
    coupons: { findUnique: async () => coupon },
    coupon_usages: { count: async () => 0 },
  };

  const service = new CouponsService(mockPrisma);
  await assert.rejects(
    async () =>
      service.validateCouponForCart({ code: 'MIN500', orderTotal: 400 }, 'user-1'),
    /Order value must be at least ₹500/,
  );
});

test('validateCouponForCart rejects when partnerStoreId does not match restricted coupon', async () => {
  const coupon = {
    id: 'c-ph',
    code: 'PIZZA20',
    discount_type: 'PERCENTAGE',
    discount_value: new Prisma.Decimal(20),
    min_order_value: new Prisma.Decimal(0),
    partner_store_id: 'store-pizza-hut',
    usage_limit: null,
    used_count: 0,
    per_user_limit: 1,
    is_active: true,
    starts_at: new Date('2026-01-01'),
    expires_at: null,
  };

  const mockPrisma: any = {
    coupons: { findUnique: async () => coupon },
    coupon_usages: { count: async () => 0 },
  };

  const service = new CouponsService(mockPrisma);
  await assert.rejects(
    async () =>
      service.validateCouponForCart(
        { code: 'PIZZA20', orderTotal: 300, partnerStoreId: 'store-apollo' },
        'user-1',
      ),
    /not valid for the selected store\/partner/,
  );
});

test('perUserLimit only counts APPLIED usages and ignores REVERSED usages', async () => {
  const coupon = {
    id: 'c-single-use',
    code: 'ONCE',
    discount_type: 'FLAT',
    discount_value: new Prisma.Decimal(50),
    min_order_value: new Prisma.Decimal(0),
    usage_limit: null,
    used_count: 1,
    per_user_limit: 1,
    is_active: true,
    starts_at: new Date('2026-01-01'),
    expires_at: null,
  };

  let queriedStatus: string | null = null;
  const mockPrisma: any = {
    coupons: { findUnique: async () => coupon },
    coupon_usages: {
      count: async ({ where }: any) => {
        queriedStatus = where.status;
        // User had 1 cancelled order which was REVERSED, so active APPLIED count = 0
        return 0;
      },
    },
  };

  const service = new CouponsService(mockPrisma);
  const result = await service.validateCouponForCart(
    { code: 'ONCE', orderTotal: 200 },
    'user-1',
  );

  assert.equal(queriedStatus, coupon_usage_status.APPLIED);
  assert.equal(result.valid, true);
});

test('reverseUsage transitions coupon_usage to REVERSED and decrements coupon used_count', async () => {
  const usage = {
    id: 'usage-1',
    coupon_id: 'c-1',
    user_id: 'user-1',
    order_id: 'order-1',
    status: coupon_usage_status.APPLIED,
  };

  let usageUpdatedStatus: string | null = null;
  let usageReversalReason: string | null = null;
  let couponDecremented = false;

  const mockPrisma: any = {
    $transaction: async (cb: any) => {
      const tx = {
        coupon_usages: {
          findFirst: async () => usage,
          update: async ({ data }: any) => {
            usageUpdatedStatus = data.status;
            usageReversalReason = data.reversal_reason;
            return { ...usage, ...data };
          },
        },
        coupons: {
          update: async () => {
            couponDecremented = true;
          },
        },
      };
      return cb(tx);
    },
  };

  const service = new CouponsService(mockPrisma);
  const reversed = await service.reverseUsage(
    'c-1',
    'user-1',
    'order-1',
    'Order cancelled by customer',
  );

  assert.notEqual(reversed, null);
  assert.equal(usageUpdatedStatus, coupon_usage_status.REVERSED);
  assert.equal(usageReversalReason, 'Order cancelled by customer');
  assert.equal(couponDecremented, true);
});
