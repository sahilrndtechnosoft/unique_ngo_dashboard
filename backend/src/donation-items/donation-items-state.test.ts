import assert from 'node:assert/strict';
import test from 'node:test';
import { donation_item_condition, donation_item_status } from '../../generated/prisma/client';
import { DonationItemsService } from './services/donation-items.service';

const makeItem = (status: donation_item_status) => ({
  id: 'item-id',
  donor_id: 'donor-id',
  title: 'Donation item',
  description: 'Description',
  category: null,
  condition: donation_item_condition.GOOD,
  quantity: 1,
  status,
  pickup_city: 'Pune',
  pickup_state: 'Maharashtra',
  pickup_address: null,
  is_pickup_only: true,
  admin_note: null,
  verified_by_id: null,
  verified_at: null,
  tags: [],
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  deleted_at: null,
});

function createService(status: donation_item_status) {
  let updateCalls = 0;
  let updateData: Record<string, unknown> | undefined;
  const prisma = {
    donation_items: {
      findFirst: async () => makeItem(status),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updateCalls += 1;
        updateData = data;
        return { ...makeItem(status), ...data };
      },
    },
    donation_item_images: { findMany: async () => [] },
  };
  const service = new DonationItemsService(
    prisma as never,
    { notifyUser: async () => undefined } as never,
  );
  return { service, get updateCalls() { return updateCalls; }, get updateData() { return updateData; } };
}

test('reject marks a donation item as rejected', async () => {
  const context = createService(donation_item_status.AVAILABLE);

  const result = await context.service.reject('item-id', { adminNote: 'Missing proof' }, 'admin-id');

  assert.equal(context.updateData?.status, donation_item_status.REJECTED);
  assert.equal(result.status, donation_item_status.REJECTED);
  assert.equal(result.isVerified, false);
});

test('cancelled donation items cannot be approved', async () => {
  const context = createService(donation_item_status.CANCELLED);

  await assert.rejects(
    () => context.service.verify('item-id', 'admin-id'),
    { message: 'Cannot approve a cancelled item.' },
  );
  assert.equal(context.updateCalls, 0);
});
