import assert from 'node:assert/strict';
import test from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminCreateAppointmentDto, AdminUpdateAppointmentDto, CreateAppointmentDto, ListAppointmentsQueryDto } from './dto/appointment.dto';
import { EligibilityService } from './services/eligibility.service';
import { AppointmentsService } from './services/appointments.service';

test('trims appointment search terms before querying', () => {
  assert.equal(plainToInstance(ListAppointmentsQueryDto, { search: '  John Doe  ' }).search, 'John Doe');
});

test('persists appointment screening and contact/location fields', async () => {
  let saved: Record<string, unknown> | undefined;
  const service = new AppointmentsService(
    {
      users: { findFirst: async () => ({ id: 'donor-id' }) },
      hospitals: { findFirst: async () => ({ id: 'hospital-id' }) },
      blood_donation_appointments: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          saved = data;
          return {
            id: 'appointment-id',
            donor_id: 'donor-id',
            hospital_id: 'hospital-id',
            campaign_id: null,
            blood_group: 'O_POSITIVE',
            appointment_date: new Date('2099-01-01'),
            time_slot: '10:00 AM - 11:00 AM',
            last_donation_date: new Date('2098-01-01'),
            had_tattoo_recently: false,
            tattoo_date: null,
            city: 'Pune',
            state: 'Maharashtra',
            contact_phone: '9876543210',
            status: 'PENDING',
            notes: null,
            cancel_reason: null,
            donation_id: null,
            for_self: true,
            beneficiary_name: null,
            beneficiary_mobile: null,
            beneficiary_relation: null,
            created_at: new Date('2098-01-01'),
            updated_at: new Date('2098-01-01'),
          };
        },
      },
    } as never,
    { checkEligibility: async () => ({ eligible: true, reasons: [] }) } as never,
    {} as never,
  );

  await service.adminCreateAppointment({
    userId: 'donor-id',
    hospitalId: 'hospital-id',
    bloodGroup: 'O_POSITIVE',
    appointmentDate: '2099-01-01',
    lastDonationDate: '2098-01-01',
    hadTattooRecently: false,
    city: 'Pune',
    state: 'Maharashtra',
    contactPhone: '9876543210',
    hasConsentForm: true,
  } as AdminCreateAppointmentDto);

  assert.equal(saved?.last_donation_date instanceof Date, true);
  assert.equal(saved?.had_tattoo_recently, false);
  assert.equal(saved?.has_consent_form, true);
  assert.equal(saved?.city, 'Pune');
  assert.equal(saved?.state, 'Maharashtra');
  assert.equal(saved?.contact_phone, '9876543210');
});

test('rejects admin appointments scheduled in the past', async () => {
  let createCalls = 0;
  const service = new AppointmentsService(
    {
      users: { findFirst: async () => ({ id: 'donor-id' }) },
      hospitals: { findFirst: async () => ({ id: 'hospital-id' }) },
      blood_donation_appointments: {
        create: async () => {
          createCalls += 1;
          return {};
        },
      },
    } as never,
    { checkEligibility: async () => ({ eligible: true, reasons: [] }) } as never,
    {} as never,
  );

  await assert.rejects(
    () =>
      service.adminCreateAppointment({
        userId: 'donor-id',
        hospitalId: 'hospital-id',
        bloodGroup: 'O_POSITIVE',
        appointmentDate: '2020-01-01',
        hadTattooRecently: false,
      } as AdminCreateAppointmentDto),
    { message: 'Appointment date cannot be in the past.' },
  );
  assert.equal(createCalls, 0);
});

test('rejects admin appointments within the donation eligibility window', async () => {
  const reasons = ['Donor must wait at least 3 months between donations. Next eligible date: 2099-12-15.'];
  let createCalls = 0;
  const service = new AppointmentsService(
    {
      users: { findFirst: async () => ({ id: 'donor-id' }) },
      hospitals: { findFirst: async () => ({ id: 'hospital-id' }) },
      blood_donation_appointments: {
        create: async () => {
          createCalls += 1;
          return {};
        },
      },
    } as never,
    { checkEligibility: async () => ({ eligible: false, reasons }) } as never,
    {} as never,
  );

  await assert.rejects(
    () =>
      service.adminCreateAppointment({
        userId: 'donor-id',
        hospitalId: 'hospital-id',
        bloodGroup: 'O_POSITIVE',
        appointmentDate: '2099-09-25',
        lastDonationDate: '2099-09-15',
        hadTattooRecently: false,
      } as AdminCreateAppointmentDto),
    { message: reasons[0] },
  );
  assert.equal(createCalls, 0);
});

test('admin create enforces the three-month rule before inserting', async () => {
  let createCalls = 0;
  const prisma = {
    users: {
      findFirst: async () => ({ id: 'donor-id' }),
      findUnique: async () => null,
    },
    hospitals: { findFirst: async () => ({ id: 'hospital-id' }) },
    blood_bank_settings: {
      findUnique: async () => ({ donation_eligibility_months: 3, tattoo_eligibility_months: 6 }),
    },
    blood_donation_appointments: {
      create: async () => {
        createCalls += 1;
        return {};
      },
    },
  };
  const service = new AppointmentsService(
    prisma as never,
    new EligibilityService(prisma as never),
    {} as never,
  );

  await assert.rejects(
    () =>
      service.adminCreateAppointment({
        userId: 'donor-id',
        hospitalId: 'hospital-id',
        bloodGroup: 'O_POSITIVE',
        appointmentDate: '2099-09-25',
        lastDonationDate: '2099-09-15',
        hadTattooRecently: false,
      } as AdminCreateAppointmentDto),
    { message: 'Donor must wait at least 3 months between donations. Next eligible date: 2099-12-15.' },
  );
  assert.equal(createCalls, 0);
});

test('checks donation eligibility against the requested appointment date', async () => {
  const settings = {
    donation_eligibility_months: 3,
    tattoo_eligibility_months: 6,
  };
  const prisma = {
    blood_bank_settings: { findUnique: async () => settings },
    users: { findUnique: async () => null },
  };
  const eligibilityService = new EligibilityService(prisma as never);
  const lastDonationDate = new Date();
  lastDonationDate.setUTCMonth(lastDonationDate.getUTCMonth() - 2);
  const appointmentDate = new Date();
  appointmentDate.setUTCDate(appointmentDate.getUTCDate() + 1);

  const result = await eligibilityService.checkEligibility(
    'donor-id',
    { lastDonationDate: lastDonationDate.toISOString(), hadTattooRecently: false },
    { useAccountHistory: false, referenceDate: appointmentDate.toISOString() },
  );

  assert.equal(result.eligible, false);
  assert.match(result.reasons[0], /Donor must wait at least 3 months between donations/);
});

test('validates notes, location, and mobile rules on appointment booking', async () => {
  const baseBooking = {
    hospitalId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    bloodGroup: 'O_POSITIVE',
    appointmentDate: '2099-01-01',
    hadTattooRecently: false,
    city: 'Vapi',
    state: 'Gujarat',
    contactPhone: '7796735387',
    notes: "Patient has doctor's prescription for scheduled donation",
  };

  // Valid booking passes validation
  const validErrors = await validate(plainToInstance(CreateAppointmentDto, baseBooking));
  assert.equal(validErrors.length, 0, JSON.stringify(validErrors));

  // notes with script or <> are rejected
  const scriptNotes = await validate(plainToInstance(CreateAppointmentDto, { ...baseBooking, notes: '<script>alert(1)</script>' }));
  assert.ok(scriptNotes.some((e) => e.property === 'notes'));

  const angleBracketNotes = await validate(plainToInstance(CreateAppointmentDto, { ...baseBooking, notes: 'Donor needs <special> care' }));
  assert.ok(angleBracketNotes.some((e) => e.property === 'notes'));

  // notes > 500 characters are rejected
  const longNotes = await validate(plainToInstance(CreateAppointmentDto, { ...baseBooking, notes: 'x'.repeat(501) }));
  assert.ok(longNotes.some((e) => e.property === 'notes'));

  // city and state with letters Unicode and . ' - & are allowed
  const symbolLocation = await validate(plainToInstance(CreateAppointmentDto, {
    ...baseBooking,
    city: "St. John's",
    state: 'Dadra & Nagar Haveli',
  }));
  assert.equal(symbolLocation.length, 0);

  // city with numbers or < > rejected
  const invalidCity = await validate(plainToInstance(CreateAppointmentDto, { ...baseBooking, city: 'City <123>' }));
  assert.ok(invalidCity.some((e) => e.property === 'city'));

  // contactPhone repeated digits rejected
  const repeatedPhone = await validate(plainToInstance(CreateAppointmentDto, { ...baseBooking, contactPhone: '9999999999' }));
  assert.ok(repeatedPhone.some((e) => e.property === 'contactPhone'));

  // contactPhone starting with < 6 rejected
  const invalidPhone = await validate(plainToInstance(CreateAppointmentDto, { ...baseBooking, contactPhone: '5555555555' }));
  assert.ok(invalidPhone.some((e) => e.property === 'contactPhone'));
});

test('sanitizes notes server-side on appointment creation', async () => {
  let createdNotes: string | null | undefined;
  const service = new AppointmentsService(
    {
      blood_donation_appointments: {
        create: async ({ data }: { data: { notes: string | null } }) => {
          createdNotes = data.notes;
          return { id: 'app-id', ...data };
        },
      },
    } as never,
    { checkEligibility: async () => ({ eligible: true, reasons: [] }) } as never,
    { notifyAdminsByEmail: async () => undefined } as never,
  );

  await (service as unknown as { createAppointmentRecord: (donorId: string, dto: unknown) => Promise<unknown> })
    .createAppointmentRecord('donor-id', {
      bloodGroup: 'O_POSITIVE',
      appointmentDate: '2099-01-01',
      hadTattooRecently: false,
      notes: '   Trimmed appointment notes   ',
    });

  assert.equal(createdNotes, 'Trimmed appointment notes');

  await (service as unknown as { createAppointmentRecord: (donorId: string, dto: unknown) => Promise<unknown> })
    .createAppointmentRecord('donor-id', {
      bloodGroup: 'O_POSITIVE',
      appointmentDate: '2099-01-01',
      hadTattooRecently: false,
      notes: '   ',
    });

  assert.equal(createdNotes, null);
});
