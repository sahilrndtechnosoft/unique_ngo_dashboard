import assert from 'node:assert/strict';
import test from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { blood_group, donation_status } from '../../generated/prisma/client';
import { UpdateDonationDto, AdminUpdateDonationDto } from './dto/donation.dto';
import { DonationsService } from './services/donations.service';

test('UpdateDonationDto: parses string booleans correctly and validates fields', async () => {
  const instance = plainToInstance(UpdateDonationDto, {
    forSelf: 'false',
    hasConsentForm: 'true',
    bloodGroup: blood_group.O_POSITIVE,
    unitsDonated: '2',
    donationDate: '2026-08-15',
    beneficiaryName: 'Jane Doe',
    beneficiaryMobile: '9876543210',
    beneficiaryRelation: 'Spouse',
  });

  assert.equal(instance.forSelf, false);
  assert.equal(instance.hasConsentForm, true);
  assert.equal(instance.unitsDonated, 2);

  const errors = await validate(instance);
  assert.equal(errors.length, 0);
});

test('UpdateDonationDto: requires beneficiary fields when forSelf is false', async () => {
  const instance = plainToInstance(UpdateDonationDto, {
    forSelf: 'false',
  });

  const errors = await validate(instance);
  const errorFields = errors.map((e) => e.property);
  assert.ok(errorFields.includes('beneficiaryName'));
  assert.ok(errorFields.includes('beneficiaryMobile'));
  assert.ok(errorFields.includes('beneficiaryRelation'));
});

test('UpdateDonationDto: rejects unitsDonated less than 0.5', async () => {
  const instance = plainToInstance(UpdateDonationDto, {
    unitsDonated: 0.2,
  });

  const errors = await validate(instance);
  assert.ok(errors.some((e) => e.property === 'unitsDonated'));
});

test('updateMyDonation: allows donor to update their own donation when PENDING or UNDER_REVIEW', async () => {
  let updatedData: Record<string, unknown> | undefined;

  const mockDonation = {
    id: 'donation-123',
    donor_id: 'donor-1',
    status: donation_status.PENDING,
    blood_group: blood_group.A_POSITIVE,
    donation_date: new Date('2026-01-01'),
    donation_center: 'Old Center',
    hospital_name: 'Old Hospital',
    hospital_id: null,
    appointment_id: null,
    city: 'Old City',
    state: 'Old State',
    units_donated: 1,
    proof_image_url: '/uploads/donations/old.jpg',
    notes: 'Old note',
    has_consent_form: false,
    for_self: true,
    beneficiary_name: null,
    beneficiary_mobile: null,
    beneficiary_relation: null,
    verified_by_id: null,
    verified_at: null,
    rejection_reason: null,
    certificate_url: null,
    is_camp_donation: false,
    campaign_id: null,
    reward_claimed: false,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const service = new DonationsService(
    {
      blood_donations: {
        findFirst: async ({ where }: { where: { id: string; donor_id?: string } }) => {
          if (where.id === 'donation-123' && where.donor_id === 'donor-1') {
            return mockDonation;
          }
          return null;
        },
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updatedData = data;
          return { ...mockDonation, ...data, units_donated: data.units_donated ?? mockDonation.units_donated };
        },
      },
    } as never,
    {} as never,
  );

  const result = await service.updateMyDonation('donor-1', 'donation-123', {
    bloodGroup: blood_group.B_POSITIVE,
    donationCenter: 'Updated Blood Center',
    city: 'Mumbai',
    state: 'Maharashtra',
    notes: 'Updated notes',
    unitsDonated: 2,
    forSelf: false,
    beneficiaryName: 'John Doe',
    beneficiaryMobile: '9876543210',
    beneficiaryRelation: 'Father',
  });

  assert.equal(result.id, 'donation-123');
  assert.equal(updatedData?.blood_group, blood_group.B_POSITIVE);
  assert.equal(updatedData?.donation_center, 'Updated Blood Center');
  assert.equal(updatedData?.city, 'Mumbai');
  assert.equal(updatedData?.units_donated, 2);
  assert.equal(updatedData?.for_self, false);
  assert.equal(updatedData?.beneficiary_name, 'John Doe');
  assert.equal(updatedData?.beneficiary_mobile, '9876543210');
  assert.equal(updatedData?.beneficiary_relation, 'Father');
});

test('updateMyDonation: rejects update when status is APPROVED or REJECTED', async () => {
  const approvedDonation = {
    id: 'donation-app',
    donor_id: 'donor-1',
    status: donation_status.APPROVED,
    blood_group: blood_group.A_POSITIVE,
    units_donated: 1,
    donation_date: new Date(),
    for_self: true,
  };

  const service = new DonationsService(
    {
      blood_donations: {
        findFirst: async () => approvedDonation,
      },
    } as never,
    {} as never,
  );

  await assert.rejects(
    () => service.updateMyDonation('donor-1', 'donation-app', { notes: 'Trying to tamper approved' }),
    (err: unknown) => err instanceof BadRequestException && err.message.includes('Only pending or under-review donations can be edited'),
  );
});

test('updateMyDonation: rejects update for another user donation (throws NotFoundException)', async () => {
  const service = new DonationsService(
    {
      blood_donations: {
        findFirst: async () => null,
      },
    } as never,
    {} as never,
  );

  await assert.rejects(
    () => service.updateMyDonation('intruder-user', 'donation-123', { notes: 'Hacked' }),
    (err: unknown) => err instanceof NotFoundException && err.message.includes('Donation not found'),
  );
});

test('updateMyDonation: switching forSelf to true nulls out beneficiary fields', async () => {
  let updatedData: Record<string, unknown> | undefined;

  const mockDonation = {
    id: 'donation-456',
    donor_id: 'donor-1',
    status: donation_status.PENDING,
    blood_group: blood_group.O_POSITIVE,
    donation_date: new Date('2026-01-01'),
    units_donated: 1,
    for_self: false,
    beneficiary_name: 'Previous Beneficiary',
    beneficiary_mobile: '9876543210',
    beneficiary_relation: 'Sibling',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const service = new DonationsService(
    {
      blood_donations: {
        findFirst: async () => mockDonation,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updatedData = data;
          return { ...mockDonation, ...data };
        },
      },
    } as never,
    {} as never,
  );

  await service.updateMyDonation('donor-1', 'donation-456', {
    forSelf: true,
  });

  assert.equal(updatedData?.for_self, true);
  assert.equal(updatedData?.beneficiary_name, null);
  assert.equal(updatedData?.beneficiary_mobile, null);
  assert.equal(updatedData?.beneficiary_relation, null);
});

test('adminUpdateDonation: successfully updates donation and replaces proof image', async () => {
  let updatedData: Record<string, unknown> | undefined;

  const mockDonation = {
    id: 'donation-adm',
    donor_id: 'donor-1',
    status: donation_status.PENDING,
    blood_group: blood_group.A_POSITIVE,
    donation_date: new Date('2026-01-01'),
    proof_image_url: '/uploads/donations/old-proof.jpg',
    units_donated: 1,
    for_self: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockDonor = {
    id: 'donor-1',
    full_name: 'Jane Donor',
    email: 'jane@example.com',
    mobile: '9876543210',
  };

  const service = new DonationsService(
    {
      blood_donations: {
        findFirst: async () => mockDonation,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updatedData = data;
          return { ...mockDonation, ...data };
        },
      },
      users: {
        findUnique: async () => mockDonor,
      },
    } as never,
    {} as never,
  );

  const result = await service.adminUpdateDonation(
    'donation-adm',
    {
      bloodGroup: blood_group.AB_POSITIVE,
      unitsDonated: 1.5,
      city: 'Pune',
      state: 'Maharashtra',
    } as AdminUpdateDonationDto,
    '/uploads/donations/new-proof.jpg',
  );

  assert.equal(updatedData?.proof_image_url, '/uploads/donations/new-proof.jpg');
  assert.equal(updatedData?.blood_group, blood_group.AB_POSITIVE);
  assert.equal(updatedData?.units_donated, 1.5);
  assert.equal(updatedData?.city, 'Pune');
  assert.equal(result.donor?.fullName, 'Jane Donor');
});
