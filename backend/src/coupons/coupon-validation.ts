import { Prisma } from '../../generated/prisma/client';

type ProductCouponRules = {
  starts_at: Date;
  expires_at: Date | null;
  usage_limit: number | null;
  used_count: number;
  applicable_to: string;
  discount_type: string;
  discount_value: Prisma.Decimal;
  max_discount: Prisma.Decimal | null;
  min_order_value: Prisma.Decimal;
};

export function productCouponEligibilityError(
  coupon: ProductCouponRules,
  orderValue: Prisma.Decimal,
  now: Date,
) {
  if (coupon.starts_at > now || (coupon.expires_at && coupon.expires_at <= now)) return 'Coupon is not currently valid';
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) return 'Coupon usage limit has been reached';
  if (coupon.applicable_to !== 'ALL' && coupon.applicable_to !== 'PRODUCTS') return 'This coupon is not valid for product orders';
  if (coupon.discount_type === 'PERCENTAGE' && coupon.discount_value.greaterThan(100)) return 'Percentage coupon cannot exceed 100%';
  if (coupon.min_order_value.greaterThan(orderValue)) return `Order value must be at least ${coupon.min_order_value} to use this coupon`;
  return null;
}

export function calculateProductCouponDiscount(coupon: ProductCouponRules, orderValue: Prisma.Decimal) {
  const rawDiscount = coupon.discount_type === 'FLAT'
    ? coupon.discount_value
    : orderValue.mul(coupon.discount_value).div(100);
  const cappedDiscount = coupon.max_discount === null
    ? rawDiscount
    : Prisma.Decimal.min(rawDiscount, coupon.max_discount);
  return Prisma.Decimal.min(cappedDiscount, orderValue).toDecimalPlaces(2);
}
