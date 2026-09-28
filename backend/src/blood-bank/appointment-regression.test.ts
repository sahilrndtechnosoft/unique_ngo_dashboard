import assert from 'node:assert/strict';
import test from 'node:test';
import { plainToInstance } from 'class-transformer';
import { AdminCreateAppointmentDto, ListAppointmentsQueryDto } from './dto/appointment.dto';
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
    {} as never,
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
  } as AdminCreateAppointmentDto);

  assert.equal(saved?.last_donation_date instanceof Date, true);
  assert.equal(saved?.had_tattoo_recently, false);
  assert.equal(saved?.city, 'Pune');
  assert.equal(saved?.state, 'Maharashtra');
  assert.equal(saved?.contact_phone, '9876543210');
});
