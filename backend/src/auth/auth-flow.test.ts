import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService } from './auth.service';
import { seller_status, user_role, user_status } from '../../generated/prisma/client';

test('OTP seller registration starts pending approval', async () => {
  let profileData: Record<string, unknown> | undefined;
  const prisma = {
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      users: {
        create: async ({ data }: any) => ({ id: 'seller-user', ...data }),
      },
      seller_profiles: {
        create: async ({ data }: any) => { profileData = data; return data; },
      },
    }),
  };
  const service = new AuthService(prisma as any, {} as any, {} as any);
  const user = await (service as any).registerSeller('9876543210');

  assert.equal(user.role, user_role.SELLER);
  assert.equal(user.status, user_status.ACTIVE);
  assert.equal(profileData?.status, seller_status.PENDING);
});
