import { BadRequestException } from '@nestjs/common';

export function assertCashOnDeliveryAllowed(
  paymentMethod: string,
  products: Array<{ name: string; allow_cod: boolean }>,
) {
  if (paymentMethod !== 'COD') return;
  const blocked = products.find((product) => !product.allow_cod);
  if (blocked) throw new BadRequestException(`Cash on delivery is unavailable for "${blocked.name}"`);
}
