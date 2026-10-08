import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAdminDashboardRequest } from './rate-limit.util';

test('admin dashboard APIs are excluded from global rate limit', () => {
  assert.equal(isAdminDashboardRequest({ originalUrl: '/api/v1/admin/notifications/notification-id' }), true);
  assert.equal(isAdminDashboardRequest({ originalUrl: '/api/v1/admin/notifications/notification-id?x=1' }), true);
  assert.equal(isAdminDashboardRequest({ originalUrl: '/api/v1/notifications' }), false);
  assert.equal(isAdminDashboardRequest({ originalUrl: '/api/v1/auth/admin/login' }), false);
  assert.equal(isAdminDashboardRequest({ originalUrl: '/api/v1/admin-login' }), false);
});
