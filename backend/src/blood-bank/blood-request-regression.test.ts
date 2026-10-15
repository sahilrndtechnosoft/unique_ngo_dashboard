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
  const personFields = ['patientName', 'city', 'state', 'contactName'];
  for (const field of personFields) {
    for (const value of ['123', '#$$%^', '<script>alert(1)</script>']) {
      const errors = await validate(plainToInstance(CreateBloodRequestDto, { ...validRequest, [field]: value }));
      const error = errors.find((item) => item.property === field);
      assert.ok(error, `${field}: ${value}`);
      const msgs = Object.values(error.constraints ?? {}).join(' ');
      assert.match(msgs, /contains invalid characters/i, `${field}: ${value}`);
    }
  }

  // Pure numbers, <>, and scripts must be rejected for hospitalName and hospitalAddress
  for (const value of ['12345', '<script>alert(1)</script>', 'City <Hospital>']) {
    const nameErrors = await validate(plainToInstance(CreateBloodRequestDto, { ...validRequest, hospitalName: value }));
    assert.ok(nameErrors.some((e) => e.property === 'hospitalName'), `hospitalName: ${value}`);

    const addrErrors = await validate(plainToInstance(CreateBloodRequestDto, { ...validRequest, hospitalAddress: value }));
    assert.ok(addrErrors.some((e) => e.property === 'hospitalAddress'), `hospitalAddress: ${value}`);
  }

  for (const value of ['abc', '123', '0000000000', '9999999999', '<script>alert(1)</script>']) {
    const errors = await validate(plainToInstance(CreateBloodRequestDto, { ...validRequest, contactMobile: value }));
    const error = errors.find((item) => item.property === 'contactMobile');
    assert.ok(error, `contactMobile: ${value}`);
    assert.ok(Object.values(error.constraints ?? {}).some((msg) => msg.includes('10-digit')));
  }
});

test('accepts Jira valid blood-request data with numbers, commas, slashes, brackets and hashes', async () => {
  const jiraData = {
    patientName: 'QA Test User',
    bloodGroup: 'O_POSITIVE',
    unitsRequired: 2,
    urgency: 'URGENT',
    hospitalName: 'QA E2E Hospital 2',
    hospitalAddress: '200 QA E2E Road, Test Area',
    city: 'Vapi',
    state: 'Gujarat',
    contactName: 'QA Test User',
    contactMobile: '7796735387',
    requiredByDate: '2099-01-01',
  };
  const errors = await validate(plainToInstance(CreateBloodRequestDto, jiraData));
  assert.equal(errors.length, 0, JSON.stringify(errors));
});

test('accepts complex hospital names and addresses with symbols, and validates notes', async () => {
  const complexData = {
    ...validRequest,
    patientName: "D'souza",
    hospitalName: "St. Mary's (Main) Hospital & Research / Unit #1",
    hospitalAddress: "Plot #12-A, St. Mark's Road, (Near Metro / Gate 2) _ Sector 4",
    city: 'Bengaluru',
    state: 'Tamil Nadu',
    contactName: 'Dr. Arjun-Mehta',
    contactMobile: '9876543210',
    notes: "Patient has doctor's prescription and needs care immediately.",
  };
  const errors = await validate(plainToInstance(CreateBloodRequestDto, complexData));
  assert.equal(errors.length, 0, JSON.stringify(errors));

  // Reject notes with scripts or angle brackets or over 500 chars
  const scriptNotes = await validate(plainToInstance(CreateBloodRequestDto, { ...complexData, notes: '<script>alert(1)</script>' }));
  assert.ok(scriptNotes.some((e) => e.property === 'notes'));

  const bracketNotes = await validate(plainToInstance(CreateBloodRequestDto, { ...complexData, notes: 'Patient condition is <critical>' }));
  assert.ok(bracketNotes.some((e) => e.property === 'notes'));

  const longNotes = await validate(plainToInstance(CreateBloodRequestDto, { ...complexData, notes: 'a'.repeat(501) }));
  assert.ok(longNotes.some((e) => e.property === 'notes'));
});

test('applies the same validation to admin updates and trims blood-request search', async () => {
  const updateErrors = await validate(plainToInstance(AdminUpdateBloodRequestDto, {
    patientName: '<script>alert(1)</script>',
    contactMobile: '0000000000',
    hospitalName: '12345',
    notes: '<img onerror=alert(1)>',
  }));
  assert.ok(updateErrors.some((error) => error.property === 'patientName'));
  assert.ok(updateErrors.some((error) => error.property === 'contactMobile'));
  assert.ok(updateErrors.some((error) => error.property === 'hospitalName'));
  assert.ok(updateErrors.some((error) => error.property === 'notes'));
  assert.equal(plainToInstance(ListBloodRequestsQueryDto, { search: '  Shubhangi  ' }).search, 'Shubhangi');
});
