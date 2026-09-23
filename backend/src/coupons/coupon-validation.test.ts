import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '../../generated/prisma/client';
import { CouponsService } from './services/coupons.service';
import { calculateProductCouponDiscount, productCouponEligibilityError } from './coupon-validation';

test('checkout revalidation catches a raised coupon minimum after initial validation', () => {
  const now = new Date('2026-09-21T00:00:00Z');
  const coupon = {
    starts_at: new Date('2026-01-01T00:00:00Z'),
    expires_at: null,
    usage_limit: null,
    used_count: 0,
    applicable_to: 'PRODUCTS',
    discount_type: 'FLAT',
    discount_value: new Prisma.Decimal(10),
    max_discount: null,
    min_order_value: new Prisma.Decimal(500),
  };
  assert.match(productCouponEligibilityError(coupon, new Prisma.Decimal(300), now) ?? '', /at least 500/);
  assert.equal(productCouponEligibilityError(coupon, new Prisma.Decimal(500), now), null);
});

test('an explicit zero max discount remains a zero cap', () => {
  const coupon = {
    starts_at: new Date('2026-01-01T00:00:00Z'),
    expires_at: null,
    usage_limit: null,
    used_count: 0,
    applicable_to: 'PRODUCTS',
    discount_type: 'PERCENTAGE',
    discount_value: new Prisma.Decimal(20),
    max_discount: new Prisma.Decimal(0),
    min_order_value: new Prisma.Decimal(0),
  };
  assert.equal(calculateProductCouponDiscount(coupon, new Prisma.Decimal(100)).toString(), '0');
});

test('coupon validation and admin output preserve an explicit zero max discount', async () => {
  const coupon = {
    id: 'coupon-id', code: 'NODISCOUNT', description: null, is_active: true,
    starts_at: new Date('2026-01-01T00:00:00Z'), expires_at: null,
    usage_limit: null, used_count: 0, per_user_limit: 1, applicable_to: 'PRODUCTS',
    discount_type: 'PERCENTAGE', discount_value: new Prisma.Decimal(20),
    max_discount: new Prisma.Decimal(0), min_order_value: new Prisma.Decimal(0),
    created_at: new Date('2026-01-01T00:00:00Z'), updated_at: new Date('2026-01-01T00:00:00Z'),
    created_by_id: 'admin-id',
  };
  const service = new CouponsService({
    coupons: { findUnique: async () => coupon },
    coupon_usages: { count: async () => 0 },
  } as never);

  const validated = await service.validateForOrder(coupon.code, 'buyer-id', new Prisma.Decimal(100));
  const adminView = await service.adminGet(coupon.id);
  assert.equal(validated.discount.toString(), '0');
  assert.equal(adminView.maxDiscount, 0);
});
