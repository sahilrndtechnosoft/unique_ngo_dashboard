import assert from 'node:assert/strict';
import test from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminUpdateBloodRequestDto, CreateBloodRequestDto, ListBloodRequestsQueryDto } from './dto/blood-request.dto';
import { BloodRequestsService } from './services/blood-requests.service';

const validRequest = {
  patientName: 'Jane Doe',
  bloodGroup: 'O_POSITIVE',
  unitsRequired: 1,
  urgency: 'MEDIUM',
  hospitalName: 'City Hospital',
  hospitalAddress: '1 Main Street',
  city: 'Pune',
  state: 'Maharashtra',
  contactName: 'Jane Doe',
  contactMobile: '9876543210',
  requiredByDate: '2099-01-01',
};

function createService() {
  return new BloodRequestsService(
    {
      blood_requests: {
        create: async () => ({}),
      },
    } as never,
    { notifyUser: async () => undefined, notifyAdminsByEmail: async () => undefined } as never,
  );
}

test('normalizes legacy urgency labels to backend enum values', () => {
  assert.equal(plainToInstance(CreateBloodRequestDto, { ...validRequest, urgency: 'Normal' }).urgency, 'MEDIUM');
  assert.equal(plainToInstance(CreateBloodRequestDto, { ...validRequest, urgency: 'Urgent' }).urgency, 'HIGH');
  assert.equal(plainToInstance(CreateBloodRequestDto, { ...validRequest, urgency: 'Critical' }).urgency, 'CRITICAL');
  assert.equal(plainToInstance(CreateBloodRequestDto, { ...validRequest, urgency: 'LOW' }).urgency, 'LOW');
});

test('rejects blood requests without supporting proof', async () => {
  await assert.rejects(
    createService().createRequest('requester-id', validRequest as never, undefined, false),
    /supporting proof\/document is required/i,
  );
});

test('rejects blood requests with a past required-by date', async () => {
  await assert.rejects(
    createService().createRequest(
      'requester-id',
      { ...validRequest, requiredByDate: '2000-01-01' } as never,
      '/uploads/blood-requests/proof.jpg',
      false,
    ),
    /Required By date cannot be in the past/i,
  );
});

test('rejects unsafe blood-request text fields and invalid mobile numbers', async () => {
  const invalidValues = ['123', '#$$%^', '<script>alert(1)</script>'];
  const textFields = ['patientName', 'hospitalName', 'hospitalAddress', 'city', 'state', 'contactName'];

  for (const field of textFields) {
    for (const value of invalidValues) {
      const errors = await validate(plainToInstance(CreateBloodRequestDto, { ...validRequest, [field]: value }));
      const error = errors.find((item) => item.property === field);
      assert.ok(error, `${field}: ${value}`);
      assert.ok(
        Object.values(error.constraints ?? {}).includes("Field contains invalid characters. Only alphabets, spaces, and valid symbols (e.g., . ' - & _ /) are allowed."),
        `${field}: ${value}`,
      );
    }
  }

  for (const value of ['abc', '123', '0000000000', '<script>alert(1)</script>']) {
    const errors = await validate(plainToInstance(CreateBloodRequestDto, { ...validRequest, contactMobile: value }));
    const error = errors.find((item) => item.property === 'contactMobile');
    assert.ok(error, `contactMobile: ${value}`);
    assert.ok(Object.values(error.constraints ?? {}).includes('Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.'));
  }
});

test('accepts supported blood-request text formats and Indian mobile numbers', async () => {
  const errors = await validate(plainToInstance(CreateBloodRequestDto, {
    ...validRequest,
    patientName: "D'souza",
    hospitalName: 'Johnson & Johnson',
    hospitalAddress: 'Ward 3/A, 12 Main Road',
    city: 'Bengaluru',
    state: 'Tamil Nadu',
    contactName: 'Dr. Arjun-Mehta',
    contactMobile: '9876543210',
  }));
  assert.equal(errors.length, 0);
});

test('applies the same validation to admin updates and trims blood-request search', async () => {
  const updateErrors = await validate(plainToInstance(AdminUpdateBloodRequestDto, {
    patientName: '<script>alert(1)</script>',
    contactMobile: '0000000000',
  }));
  assert.ok(updateErrors.some((error) => error.property === 'patientName'));
  assert.ok(updateErrors.some((error) => error.property === 'contactMobile'));
  assert.equal(plainToInstance(ListBloodRequestsQueryDto, { search: '  Shubhangi  ' }).search, 'Shubhangi');
});
