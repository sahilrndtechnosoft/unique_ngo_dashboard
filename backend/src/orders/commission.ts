import { Prisma } from '../../generated/prisma/client';

type CommissionRates = {
  product?: Prisma.Decimal | null;
  category?: Prisma.Decimal | null;
  seller?: Prisma.Decimal | null;
  platform: Prisma.Decimal;
};

export function calculateLineTax(
  subtotal: Prisma.Decimal,
  isTaxable: boolean,
  taxRate: Prisma.Decimal,
) {
  return isTaxable
    ? subtotal.mul(taxRate).div(100).toDecimalPlaces(2)
    : new Prisma.Decimal(0);
}

export function allocateDiscountByLine(
  lines: Array<{ id: string; subtotal: Prisma.Decimal }>,
  discount: Prisma.Decimal,
) {
  const result = new Map(lines.map((line) => [line.id, new Prisma.Decimal(0)]));
  const totalCents = lines.reduce((sum, line) => sum + line.subtotal.mul(100).toNumber(), 0);
  const discountCents = discount.mul(100).toNumber();
  if (discountCents <= 0 || totalCents <= 0) return result;
  if (discountCents > totalCents) throw new RangeError('Discount cannot exceed the item subtotal');

  const shares = lines.map((line, index) => {
    const lineCents = line.subtotal.mul(100).toNumber();
    const numerator = new Prisma.Decimal(discountCents).mul(lineCents);
    const cents = numerator.div(totalCents).floor().toNumber();
    return { id: line.id, index, cents, remainder: numerator.mod(totalCents) };
  });
  let remainingCents = discountCents - shares.reduce((sum, share) => sum + share.cents, 0);
  shares.sort((a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index);
  for (const share of shares) {
    if (remainingCents <= 0) break;
    if (share.cents < lines[share.index].subtotal.mul(100).toNumber()) {
      share.cents += 1;
      remainingCents -= 1;
    }
  }
  for (const share of shares) result.set(share.id, new Prisma.Decimal(share.cents).div(100));
  return result;
}

export function allocateAmountByLine(
  lines: Array<{ id: string; weight: Prisma.Decimal }>,
  amount: Prisma.Decimal,
) {
  const result = new Map(lines.map((line) => [line.id, new Prisma.Decimal(0)]));
  const amountCents = amount.mul(100).toNumber();
  if (amountCents <= 0 || lines.length === 0) return result;

  const weights = lines.map((line) => Math.max(0, line.weight.mul(100).toNumber()));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const shares = lines.map((line, index) => {
    const numerator = new Prisma.Decimal(amountCents).mul(totalWeight > 0 ? weights[index] : 1);
    const denominator = totalWeight > 0 ? totalWeight : lines.length;
    const cents = numerator.div(denominator).floor().toNumber();
    return { id: line.id, index, cents, remainder: numerator.mod(denominator) };
  });
  let remainingCents = amountCents - shares.reduce((sum, share) => sum + share.cents, 0);
  const rankedShares = [...shares].sort((a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index);
  for (let index = 0; remainingCents > 0; index++, remainingCents--) {
    rankedShares[index % rankedShares.length].cents += 1;
  }
  for (const share of shares) result.set(share.id, new Prisma.Decimal(share.cents).div(100));
  return result;
}

export function calculateLineCommission(
  sellerId: string | null,
  discountedSubtotal: Prisma.Decimal,
  rates: CommissionRates,
) {
  const rate = sellerId === null
    ? new Prisma.Decimal(0)
    : rates.product ?? rates.category ?? rates.seller ?? rates.platform;
  const amount = sellerId === null
    ? new Prisma.Decimal(0)
    : discountedSubtotal.mul(rate).div(100).toDecimalPlaces(2);
  return { rate, amount };
}

export function calculateSellerPayout(
  sellerId: string | null,
  discountedSubtotal: Prisma.Decimal,
  taxAmount: Prisma.Decimal,
  commissionAmount: Prisma.Decimal,
) {
  return sellerId === null
    ? new Prisma.Decimal(0)
    : discountedSubtotal.add(taxAmount).sub(commissionAmount).toDecimalPlaces(2);
}
