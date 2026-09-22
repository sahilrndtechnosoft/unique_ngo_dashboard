import assert from 'node:assert/strict';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { test } from 'node:test';
import { product_status } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from './products.service';

test('admin edits cannot approve or reject a pending product outside the review actions', async () => {
  const pendingProduct = {
    id: 'product-id',
    status: product_status.PENDING_REVIEW,
    seller_id: 'seller-id',
  };
  let productUpdates = 0;
  const prisma = {
    products: {
      findFirst: async () => pendingProduct,
      update: async () => { productUpdates += 1; },
    },
  } as unknown as PrismaService;
  const service = new ProductsService(prisma);

  await assert.rejects(
    service.updateProduct('product-id', { status: product_status.ACTIVE }, { isAdmin: true, actorId: 'admin-id' }),
    BadRequestException,
  );
  await assert.rejects(
    service.updateProduct('product-id', { status: product_status.REJECTED }, { isAdmin: true, actorId: 'admin-id' }),
    BadRequestException,
  );
  assert.equal(productUpdates, 0);
});

test('admin cannot create an active product for an inactive seller', async () => {
  let productCreates = 0;
  const prisma = {
    product_categories: { findUnique: async () => ({ id: 'category-id', is_active: true }) },
    seller_profiles: {
      findFirst: async () => ({ id: 'seller-id', status: 'PENDING', deleted_at: null }),
    },
    products: { create: async () => { productCreates += 1; } },
  } as unknown as PrismaService;
  const service = new ProductsService(prisma);

  await assert.rejects(service.createProduct({
    name: 'Seller product',
    categoryId: 'category-id',
    sellerId: 'seller-id',
    description: 'Product awaiting seller activation',
    price: 100,
  }, { isAdmin: true, actorId: 'admin-id' }), BadRequestException);
  assert.equal(productCreates, 0);
});

test('seller edits always return the product to review', async () => {
  const product = {
    id: 'product-id',
    seller_id: 'seller-id',
    status: product_status.ACTIVE,
    category_id: 'category-id',
    tags: [],
  };
  let updatedStatus: product_status | undefined;
  const prisma = {
    products: {
      findFirst: async ({ where }: { where?: { slug?: string } }) => where?.slug ? null : product,
      update: async ({ data }: { data: { status?: product_status } }) => {
        updatedStatus = data.status;
        return { ...product, ...data };
      },
      findMany: async () => [],
    },
    product_images: { findMany: async () => [] },
    product_categories: { findUnique: async () => null },
    seller_profiles: { findUnique: async () => null },
  } as unknown as PrismaService;
  const service = new ProductsService(prisma);

  await service.updateProduct('product-id', { name: 'Edited listing', resubmitForReview: false } as never, {
    isAdmin: false,
    sellerProfileId: 'seller-id',
  });
  assert.equal(updatedStatus, product_status.PENDING_REVIEW);
});

test('approval conflicts when the product changes after the review version was read', async () => {
  const reviewedAt = new Date('2026-09-20T10:00:00Z');
  let updateWhere: Record<string, unknown> | undefined;
  const prisma = {
    products: {
      findFirst: async () => ({
        id: 'product-id',
        seller_id: 'seller-id',
        status: product_status.PENDING_REVIEW,
        updated_at: reviewedAt,
      }),
      updateMany: async ({ where }: { where: Record<string, unknown> }) => {
        updateWhere = where;
        return { count: 0 };
      },
    },
    seller_profiles: {
      findFirst: async () => ({ id: 'seller-id' }),
    },
  } as unknown as PrismaService;
  const service = new ProductsService(prisma);

  await assert.rejects(service.approveProduct('product-id', 'admin-id'), ConflictException);
  assert.deepEqual(updateWhere?.updated_at, {
    gte: reviewedAt,
    lt: new Date(reviewedAt.getTime() + 1),
  });
});

test('seller image uploads and deletes send the product back to review', async () => {
  let image: any;
  const productStatuses: product_status[] = [];
  const tx = {
    product_images: {
      updateMany: async () => ({ count: 1 }),
      count: async () => image ? 1 : 0,
      create: async ({ data }: any) => {
        image = { ...data, id: 'image-id', alt_text: null, created_at: new Date() };
        return image;
      },
      delete: async () => { image = null; },
      findFirst: async () => null,
      update: async () => undefined,
    },
    products: {
      updateMany: async ({ data }: any) => {
        productStatuses.push(data.status);
        return { count: 1 };
      },
    },
  };
  const prisma = {
    products: { findFirst: async () => ({ id: 'product-id', seller_id: 'seller-id' }) },
    product_images: { findFirst: async () => image },
    $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new ProductsService(prisma);

  const created = await service.addProductImage('product-id', '/uploads/products/test.png', { sellerId: 'seller-id' });
  await service.deleteProductImage('product-id', created.id, 'seller-id');

  assert.deepEqual(productStatuses, [product_status.PENDING_REVIEW, product_status.PENDING_REVIEW]);
});
