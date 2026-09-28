import assert from 'node:assert/strict';
import test from 'node:test';
import { bloodRequestUrgencyStatus } from '../src/pages/Admin/blood-request-display';

test('keeps Medium urgency when a request is marked emergency', () => {
    assert.equal(bloodRequestUrgencyStatus({ urgency: 'MEDIUM', isEmergency: true }), 'MEDIUM');
});

test('keeps High urgency when a request is marked emergency', () => {
    assert.equal(bloodRequestUrgencyStatus({ urgency: 'HIGH', isEmergency: true }), 'HIGH');
});
