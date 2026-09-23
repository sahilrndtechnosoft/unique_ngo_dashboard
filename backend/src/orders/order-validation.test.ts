import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { assertCashOnDeliveryAllowed } from './order-validation';

test('COD is rejected when any order product disables it', () => {
  assert.throws(
    () => assertCashOnDeliveryAllowed('COD', [
      { name: 'Allowed', allow_cod: true },
      { name: 'Prepaid only', allow_cod: false },
    ]),
    (error: unknown) => error instanceof BadRequestException && error.message.includes('Prepaid only'),
  );
});

test('COD policy does not restrict prepaid checkout', () => {
  assert.doesNotThrow(() => assertCashOnDeliveryAllowed('CARD', [{ name: 'Prepaid only', allow_cod: false }]));
});
