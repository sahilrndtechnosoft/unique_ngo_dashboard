import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '../../generated/prisma/client';
import { allocateAmountByLine, allocateDiscountByLine, calculateLineCommission, calculateSellerPayout } from './commission';

const decimal = (value: number) => new Prisma.Decimal(value);

test('commission uses product, category, seller, then platform rate on the discounted subtotal', () => {
  const subtotal = decimal(80);
  const platform = decimal(10);

  assert.deepEqual(
    calculateLineCommission('seller', subtotal, {
      product: decimal(15), category: decimal(12), seller: decimal(8), platform,
    }),
    { rate: decimal(15), amount: decimal(12) },
  );
  assert.equal(calculateLineCommission('seller', subtotal, {
    product: decimal(0), category: decimal(12), platform,
  }).rate.toString(), '0');
  assert.equal(calculateLineCommission('seller', subtotal, {
    category: decimal(12), seller: decimal(8), platform,
  }).amount.toString(), '9.6');
  assert.equal(calculateLineCommission('seller', subtotal, {
    seller: decimal(8), platform,
  }).amount.toString(), '6.4');
  assert.equal(calculateLineCommission('seller', subtotal, { platform }).amount.toString(), '8');
});

test('admin-owned products have no commission or seller payout', () => {
  const result = calculateLineCommission(null, decimal(80), {
    product: decimal(15), category: decimal(12), seller: decimal(8), platform: decimal(10),
  });
  assert.equal(result.rate.toString(), '0');
  assert.equal(result.amount.toString(), '0');
  assert.equal(calculateSellerPayout(null, decimal(80), decimal(8), result.amount).toString(), '0');
  assert.equal(calculateSellerPayout('seller', decimal(80), decimal(8), decimal(12)).toString(), '76');
});

test('discount allocation stays non-negative and sums exactly to the coupon value', () => {
  const allocations = allocateDiscountByLine(
    ['a', 'b', 'c', 'd'].map((id) => ({ id, subtotal: decimal(1) })),
    decimal(0.02),
  );
  assert.deepEqual([...allocations.values()].map(String), ['0.01', '0.01', '0', '0']);
  assert.equal([...allocations.values()].reduce((sum, amount) => sum.add(amount), decimal(0)).toString(), '0.02');
});

test('amount allocation preserves every cent and breaks equal-weight ties consistently', () => {
  const allocations = allocateAmountByLine(
    ['a', 'b', 'c'].map((id) => ({ id, weight: decimal(1) })),
    decimal(0.01),
  );
  assert.deepEqual([...allocations.values()].map(String), ['0.01', '0', '0']);
  assert.equal([...allocations.values()].reduce((sum, amount) => sum.add(amount), decimal(0)).toString(), '0.01');
});
