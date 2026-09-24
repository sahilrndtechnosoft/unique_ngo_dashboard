import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '../../../generated/prisma/client';
import { ProductsService } from './products.service';

test('variant lifecycle normalizes SKU and keeps variant stock separate from parent stock', async () => {
  let created: any;
  const product = {
    id: 'product-id',
    seller_id: null,
    deleted_at: null,
    status: 'ACTIVE',
    category_id: 'category-id',
    price: new Prisma.Decimal(100),
    compare_at_price: null,
  };
  const tx = {
    product_variants: {
      create: async ({ data }: any) => {
        created = { ...data, id: 'variant-id', compare_at_price: null, weight_grams: null, image_url: null, attributes: data.attributes, stock_quantity: data.stock_quantity };
        return created;
      },
    },
  };
  const prisma = {
    products: {
      findFirst: async ({ where }: any) => where?.sku ? null : product,
    },
    product_variants: {
      findFirst: async () => null,
    },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as import('../../prisma/prisma.service').PrismaService;

  await new ProductsService(prisma).createVariant('product-id', {
    name: 'Blue / M',
    sku: '  tee-blue-m ',
    price: 80,
    stockQuantity: 3,
    attributes: { color: 'blue', size: 'M' },
  });

  assert.equal(created.sku, 'TEE-BLUE-M');
  assert.equal(created.stock_quantity, 3);
  assert.deepEqual(created.attributes, { color: 'blue', size: 'M' });
});
