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

test('OtpService generates default OTP 1234 and verifies it for testing', async () => {
  let createdOtpData: any;
  let sentOtp: string | undefined;
  let updatedData: any;
  const prisma = {
    otp_verifications: {
      findFirst: async () => (createdOtpData ? { id: 'otp-id', ...createdOtpData, attempts: 0, max_attempts: 5 } : null),
      create: async ({ data }: any) => {
        createdOtpData = data;
        return { id: 'otp-id', ...data };
      },
      update: async ({ data }: any) => {
        updatedData = data;
        return { id: 'otp-id', ...data };
      },
    },
  };
  const configService = {
    get: (key: string) => {
      if (key === 'app.otpExpiryMinutes') return 5;
      if (key === 'app.bcryptRounds') return 4;
      if (key === 'app.exposeOtpInResponse') return true;
      if (key === 'app.defaultOtp') return '1234';
      return null;
    },
  };
  const smsService = {
    sendOtp: async (_mobile: string, otp: string) => {
      sentOtp = otp;
    },
  };

  const { OtpService } = await import('./services/otp.service');
  const otpService = new OtpService(prisma as any, configService as any, smsService as any);
  const result = await otpService.sendOtp('9876543210');

  assert.equal(result.otp, '1234');
  assert.equal(sentOtp, '1234');

  await otpService.verifyOtp('9876543210', '1234');
  assert.equal(updatedData.is_used, true);
});
