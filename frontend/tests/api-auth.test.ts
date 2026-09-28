import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldRedirectAfterUnauthorized } from '../src/services/api-auth';

test('does not redirect after a failed public login request', () => {
    assert.equal(shouldRedirectAfterUnauthorized('/auth/admin/login'), false);
});

test('still redirects expired sessions for protected requests', () => {
    assert.equal(shouldRedirectAfterUnauthorized('/orders'), true);
});
