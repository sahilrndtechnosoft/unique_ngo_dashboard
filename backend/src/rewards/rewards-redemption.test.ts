import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  catalog_item_type,
  ledger_entry_type,
  Prisma,
  redemption_status,
  reward_activity,
  voucher_status,
} from '../../generated/prisma/client';
import { MockPartnerAdapter } from '../partners/adapters/mock-partner.adapter';
import { PartnerAdapterFactory } from '../partners/adapters/partner-adapter.factory';
import { PizzaHutPartnerAdapter } from '../partners/adapters/pizza-hut.adapter';
import { RedemptionsService } from '../redemptions/services/redemptions.service';
import { RewardsCatalogService } from '../rewards-catalog/services/rewards-catalog.service';
import { RewardsService } from './services/rewards.service';
import { VouchersService } from '../vouchers/services/vouchers.service';

test('FIFO deduction deducts points from the oldest unexpired credit lots first', async () => {
  const wallet = {
    id: 'wallet-1',
    user_id: 'user-1',
    current_balance: 700,
    total_earned: 700,
    total_redeemed: 0,
    lifetime_balance: 700,
    tier: 'BRONZE',
  };

  const lot1 = {
    id: 'lot-1',
    wallet_id: 'wallet-1',
    entry_type: ledger_entry_type.CREDIT,
    remaining_points: 300,
    is_expired: false,
    expires_at: new Date('2027-01-01'),
    created_at: new Date('2026-01-01'),
  };

  const lot2 = {
    id: 'lot-2',
    wallet_id: 'wallet-1',
    entry_type: ledger_entry_type.CREDIT,
    remaining_points: 400,
    is_expired: false,
    expires_at: new Date('2027-02-01'),
    created_at: new Date('2026-02-01'),
  };

  const updatedLots: Record<string, number> = {};
  const mockTx: any = {
    reward_wallets: {
      findUnique: async () => wallet,
      update: async ({ data }: any) => Object.assign(wallet, data),
    },
    $queryRaw: async () => [],
    reward_ledger_entries: {
      findMany: async () => [lot1, lot2],
      update: async ({ where, data }: any) => {
        updatedLots[where.id] = data.remaining_points;
        return { ...where, ...data };
      },
      create: async ({ data }: any) => ({ id: 'debit-1', ...data }),
    },
    reward_transactions: {
      create: async ({ data }: any) => ({ id: 'tx-1', ...data }),
    },
  };

  const service = new RewardsService(null as any);
  const result = await service.deductPointsInsideTx(mockTx, {
    userId: 'user-1',
    points: 450,
    description: 'Voucher redemption',
    referenceType: 'REDEMPTION',
    referenceId: 'redemption-1',
  });

  // Lot 1 (300 pts) fully consumed -> 0
  assert.equal(updatedLots['lot-1'], 0);
  // Lot 2 (400 pts) consumed 150 pts -> 250 remaining
  assert.equal(updatedLots['lot-2'], 250);
  // Wallet new balance: 700 - 450 = 250
  assert.equal(result.balanceAfter, 250);
  assert.equal(wallet.current_balance, 250);
  assert.equal(wallet.total_redeemed, 450);
});

test('deductPointsInsideTx rejects deduction when points balance is insufficient', async () => {
  const wallet = {
    id: 'wallet-1',
    user_id: 'user-1',
    current_balance: 100,
    total_earned: 100,
    total_redeemed: 0,
    lifetime_balance: 100,
    tier: 'BRONZE',
  };

  const mockTx: any = {
    reward_wallets: { findUnique: async () => wallet },
    $queryRaw: async () => [],
  };

  const service = new RewardsService(null as any);
  await assert.rejects(
    async () =>
      service.deductPointsInsideTx(mockTx, {
        userId: 'user-1',
        points: 200,
        description: 'Voucher redemption',
        referenceType: 'REDEMPTION',
        referenceId: 'redemption-1',
      }),
    /Insufficient points balance/,
  );
});

test('catalog item stock reservation rejects out-of-stock items and decrements stock under lock', async () => {
  const inStockItem = {
    id: 'item-1',
    title: 'Pizza Hut ₹200 Voucher',
    stock: 5,
    is_active: true,
    starts_at: null,
    expires_at: null,
  };

  const outOfStockItem = {
    id: 'item-2',
    title: 'Limited Event T-Shirt',
    stock: 0,
    is_active: true,
    starts_at: null,
    expires_at: null,
  };

  let decrementedStock: number | null = null;
  const mockTx: any = {
    rewards_catalog_items: {
      findUnique: async ({ where }: any) => {
        if (where.id === 'item-1') return inStockItem;
        if (where.id === 'item-2') return outOfStockItem;
        return null;
      },
      update: async ({ where, data }: any) => {
        decrementedStock = data.stock;
        return { ...where, ...data };
      },
    },
    $queryRaw: async () => [],
  };

  const catalogService = new RewardsCatalogService(null as any);

  // In-stock reservation decrements stock
  await catalogService.reserveStockInsideTx(mockTx, 'item-1');
  assert.equal(decrementedStock, 4);

  // Out-of-stock reservation throws
  await assert.rejects(
    async () => catalogService.reserveStockInsideTx(mockTx, 'item-2'),
    /out of stock/,
  );
});

test('vouchers service generates unguessable codes and security PINs with correct formats', async () => {
  const prismaMock: any = {
    vouchers: { findUnique: async () => null },
  };
  const factoryMock: any = {};
  const vouchersService = new VouchersService(prismaMock, factoryMock);

  const code1 = await vouchersService.generateSecureCode('PH');
  const code2 = await vouchersService.generateSecureCode('PH');
  assert.match(code1, /^PH-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.notEqual(code1, code2);

  const pin = vouchersService.generateSecurityPin();
  assert.match(pin, /^\d{4}$/);
});

test('redeemVoucher prevents double-redemption of the same voucher', async () => {
  const activeVoucher = {
    id: 'vch-1',
    code: 'PH-7A9B-2K4M',
    status: voucher_status.ACTIVE,
    security_pin: '4829',
    expires_at: new Date('2027-01-01'),
    monetary_value: new Prisma.Decimal(200),
    partner_store_id: null,
  };

  const alreadyRedeemedVoucher = {
    ...activeVoucher,
    status: voucher_status.REDEEMED,
    redeemed_at: new Date('2026-05-01'),
  };

  const prismaMock: any = {
    $transaction: async (cb: any) => {
      const tx = {
        vouchers: {
          findUnique: async () => alreadyRedeemedVoucher,
          update: async ({ data }: any) => ({ ...alreadyRedeemedVoucher, ...data }),
        },
        $queryRaw: async () => [],
        redemption_audit_logs: { create: async () => ({}) },
      };
      return cb(tx);
    },
  };

  const vouchersService = new VouchersService(prismaMock, {} as any);
  await assert.rejects(
    async () =>
      vouchersService.redeemVoucher({
        code: 'PH-7A9B-2K4M',
        securityPin: '4829',
      }),
    /already redeemed/,
  );
});

test('redeemVoucher rejects wrong security PIN when required', async () => {
  const activeVoucher = {
    id: 'vch-1',
    code: 'PH-7A9B-2K4M',
    status: voucher_status.ACTIVE,
    security_pin: '4829',
    expires_at: new Date('2027-01-01'),
    monetary_value: new Prisma.Decimal(200),
    partner_store_id: null,
  };

  const prismaMock: any = {
    $transaction: async (cb: any) => {
      const tx = {
        vouchers: {
          findUnique: async () => activeVoucher,
        },
        $queryRaw: async () => [],
      };
      return cb(tx);
    },
  };

  const vouchersService = new VouchersService(prismaMock, {} as any);
  await assert.rejects(
    async () =>
      vouchersService.redeemVoucher({
        code: 'PH-7A9B-2K4M',
        securityPin: '9999', // wrong pin
      }),
    /Valid security PIN is required/,
  );
});

test('redemption engine performs compensating rollback and point refund if partner call fails', async () => {
  const wallet = {
    id: 'wallet-1',
    user_id: 'user-1',
    current_balance: 500,
    tier: 'BRONZE',
  };

  const catalogItem = {
    id: 'item-ph-200',
    title: '₹200 Pizza Hut Voucher',
    points_cost: 200,
    monetary_value: new Prisma.Decimal(200),
    partner_store_id: 'partner-ph',
    validity_days: 30,
    min_user_tier: 'BRONZE',
    is_active: true,
    starts_at: null,
    expires_at: null,
    stock: 10,
  };

  const partnerStore = {
    id: 'partner-ph',
    slug: 'pizza-hut',
    adapter_type: 'PIZZA_HUT',
    config: null,
  };

  let pointsRefunded = false;
  let stockRestored = false;
  let voucherCancelled = false;
  let redemptionMarkedFailed = false;

  const mockPrisma: any = {
    reward_redemptions: {
      findUnique: async () => null,
      update: async ({ data }: any) => {
        if (data.status === redemption_status.FAILED) redemptionMarkedFailed = true;
      },
    },
    reward_wallets: {
      findUnique: async () => wallet,
    },
    rewards_catalog_items: {
      findUnique: async () => catalogItem,
    },
    partner_stores: {
      findUnique: async () => partnerStore,
    },
    users: {
      findUnique: async () => ({ email: 'test@example.com', mobile: '9999999999' }),
    },
    $transaction: async (cb: any) => {
      const tx = {
        reward_redemptions: {
          create: async ({ data }: any) => ({ id: 'red-1', ...data }),
          update: async ({ data }: any) => {
            if (data.status === redemption_status.FAILED) redemptionMarkedFailed = true;
          },
        },
        vouchers: {
          update: async ({ data }: any) => {
            if (data.status === voucher_status.CANCELLED) voucherCancelled = true;
          },
        },
        redemption_audit_logs: { create: async () => ({}) },
      };
      return cb(tx);
    },
  };

  const mockRewardsService: any = {
    deductPointsInsideTx: async () => ({ balanceAfter: 300 }),
    refundPointsInsideTx: async () => {
      pointsRefunded = true;
    },
  };

  const mockCatalogService: any = {
    reserveStockInsideTx: async () => catalogItem,
    restoreStockInsideTx: async () => {
      stockRestored = true;
    },
  };

  const mockVouchersService: any = {
    issueVoucherInsideTx: async () => ({
      id: 'vch-1',
      code: 'PH-TEST-FAIL',
      expires_at: new Date('2027-01-01'),
    }),
  };

  // Failing partner adapter
  const mockAdapterFactory: any = {
    getAdapter: () => ({
      issueVoucher: async () => ({
        success: false,
        error: 'Pizza Hut API gateway timeout (504)',
      }),
    }),
  };

  const redemptionsService = new RedemptionsService(
    mockPrisma,
    mockRewardsService,
    mockCatalogService,
    mockVouchersService,
    mockAdapterFactory,
  );

  await assert.rejects(
    async () =>
      redemptionsService.redeemCatalogItem('user-1', {
        catalogItemId: 'item-ph-200',
      }),
    /Your points have been refunded in full/,
  );

  assert.equal(pointsRefunded, true, 'Points must be refunded on partner failure');
  assert.equal(stockRestored, true, 'Stock must be restored on partner failure');
  assert.equal(voucherCancelled, true, 'Voucher must be cancelled on partner failure');
  assert.equal(redemptionMarkedFailed, true, 'Redemption record must be marked FAILED');
});
