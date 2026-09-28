import assert from 'node:assert/strict';
import test from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { user_role } from '../../../generated/prisma/client';
import { CreateAdminUserDto } from './admin-user.dto';

const baseUser = {
  email: 'person@example.com',
  password: 'Password123!',
  role: user_role.USER,
};

async function validateName(fullName: string) {
  return validate(plainToInstance(CreateAdminUserDto, { ...baseUser, fullName }));
}

test('rejects non-alphabetic admin user names', async () => {
  for (const fullName of ['123', '#$$%^', '<script>alert(1)</script>']) {
    const errors = await validateName(fullName);
    assert.ok(errors.some((error) => error.property === 'fullName'), fullName);
  }
});

test('accepts alphabetic names separated by spaces', async () => {
  const errors = await validateName('Jane Doe');
  assert.equal(errors.some((error) => error.property === 'fullName'), false);
});
