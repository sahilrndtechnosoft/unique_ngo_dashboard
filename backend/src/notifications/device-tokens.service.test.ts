import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeviceTokensService } from './services/device-tokens.service';

test('registerToken replaces a user device token and deactivates stale duplicates', async () => {
  const calls: unknown[] = [];
  const prisma = {
    device_tokens: {
      upsert: (args: unknown) => ({ op: 'upsert', args }),
      updateMany: (args: unknown) => ({ op: 'updateMany', args }),
    },
    $transaction: async (ops: unknown[]) => {
      calls.push(...ops);
    },
  };
  const service = new DeviceTokensService(prisma as any);

  await service.registerToken('user-1', {
    token: 'eNr6z6mHTDqj-current-token',
    platform: 'android',
    deviceId: ' AP3A.240617.008 ',
  });

  assert.equal((calls[0] as any).args.where.user_id_device_id_platform.platform, 'ANDROID');
  assert.equal((calls[0] as any).args.where.user_id_device_id_platform.device_id, 'AP3A.240617.008');
  assert.equal((calls[0] as any).args.update.token, 'eNr6z6mHTDqj-current-token');
  assert.equal((calls[1] as any).args.where.platform, undefined);
  assert.equal((calls[1] as any).args.where.token.not, 'eNr6z6mHTDqj-current-token');
  assert.equal((calls[1] as any).args.data.is_active, false);
  assert.equal((calls[2] as any).args.where.token, 'eNr6z6mHTDqj-current-token');
});

test('getActiveTokensForUsers returns the latest active token per user device', async () => {
  const prisma = {
    device_tokens: {
      findMany: async () => [
        { user_id: 'user-1', platform: 'ANDROID', device_id: 'AP3A.240617.008', token: 'eNr6z6mHTDqj-current-token' },
        { user_id: 'user-1', platform: 'ANDROID', device_id: 'AP3A.240617.008', token: 'old-same-device-token' },
        { user_id: 'user-1', platform: 'ANDROID', device_id: 'BP4A.251205.006', token: 'other-device-token' },
      ],
    },
  };
  const service = new DeviceTokensService(prisma as any);

  assert.deepEqual(await service.getActiveTokensForUsers(['user-1']), ['eNr6z6mHTDqj-current-token', 'other-device-token']);
});
