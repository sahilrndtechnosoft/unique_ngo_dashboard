import assert from 'node:assert/strict';
import test from 'node:test';
import { UsersService } from './users.service';

test('UsersService returns hasConsentForm and consentForm in profile', async () => {
  const fakeUser = {
    id: 'user-123',
    role: 'USER',
    status: 'ACTIVE',
    full_name: 'Test User',
    email: 'test@example.com',
    mobile: '9876543210',
    mobile_verified: true,
    email_verified: true,
    gender: 'MALE',
    blood_group: 'O_POSITIVE',
    bio: 'Test bio',
    profile_image_url: null,
    is_available_donor: true,
    has_consent_form: true,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-02'),
  };

  const prisma = {
    users: {
      findFirst: async () => fakeUser,
      update: async () => fakeUser,
    },
    user_addresses: {
      findFirst: async () => null,
      upsert: async () => ({}),
    },
  };
  const config = { get: () => 10 };

  const service = new UsersService(prisma as any, config as any);
  const profile = await service.getProfile('user-123');

  assert.equal(profile.hasConsentForm, true);
  assert.equal(profile.consentForm, true);
});

test('UsersService updates has_consent_form in updateProfile', async () => {
  let updatedData: any;
  const fakeUser = {
    id: 'user-123',
    role: 'USER',
    status: 'ACTIVE',
    full_name: 'Test User',
    email: 'test@example.com',
    mobile: '9876543210',
    mobile_verified: true,
    email_verified: true,
    gender: 'MALE',
    blood_group: 'O_POSITIVE',
    bio: 'Test bio',
    profile_image_url: null,
    is_available_donor: true,
    has_consent_form: false,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-02'),
  };

  const prisma = {
    users: {
      findFirst: async () => fakeUser,
      update: async ({ data }: any) => {
        updatedData = data;
        return { ...fakeUser, ...data };
      },
    },
    user_addresses: {
      findFirst: async () => null,
      upsert: async () => ({}),
    },
  };
  const config = { get: () => 10 };

  const service = new UsersService(prisma as any, config as any);

  // Update using hasConsentForm
  const updated1 = await service.updateProfile('user-123', {
    hasConsentForm: true,
  });

  assert.equal(updatedData.has_consent_form, true);
  assert.equal(updated1.hasConsentForm, true);
  assert.equal(updated1.consentForm, true);

  // Update using consentForm alias
  const updated2 = await service.updateProfile('user-123', {
    consentForm: false,
  });

  assert.equal(updatedData.has_consent_form, false);
  assert.equal(updated2.hasConsentForm, false);
  assert.equal(updated2.consentForm, false);
});
