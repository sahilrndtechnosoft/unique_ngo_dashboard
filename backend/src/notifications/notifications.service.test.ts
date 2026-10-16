import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotificationsService } from './services/notifications.service';

test('listMyNotifications marks previously undelivered notifications as delivered (sent_at updated)', async () => {
  const existingNotifications = [
    {
      id: 'notif-1',
      user_id: 'user-1',
      type: 'SYSTEM',
      channel: 'PUSH',
      title: 'Title 1',
      body: 'Body 1',
      data: null,
      is_read: false,
      sent_at: null,
      created_at: new Date('2026-10-15T10:00:00Z'),
    },
    {
      id: 'notif-2',
      user_id: 'user-1',
      type: 'SYSTEM',
      channel: 'PUSH',
      title: 'Title 2',
      body: 'Body 2',
      data: null,
      is_read: true,
      sent_at: new Date('2026-10-15T09:00:00Z'),
      created_at: new Date('2026-10-15T09:00:00Z'),
    },
  ];

  let updatedWhere: any = null;
  let updatedData: any = null;

  const prismaMock = {
    notifications: {
      count: async () => existingNotifications.length,
      findMany: async () => existingNotifications.map((n) => ({ ...n })),
      updateMany: async ({ where, data }: any) => {
        updatedWhere = where;
        updatedData = data;
        return { count: 1 };
      },
    },
  };

  const service = new NotificationsService(prismaMock as any, {} as any, {} as any, {} as any);
  const result = await service.listMyNotifications('user-1', {});

  assert.deepEqual(updatedWhere, { id: { in: ['notif-1'] } });
  assert.ok(updatedData.sent_at instanceof Date);
  assert.ok(result.items[0].sentAt instanceof Date);
  assert.equal(result.items[1].sentAt?.toISOString(), '2026-10-15T09:00:00.000Z');
});

test('getMyNotification marks notification as delivered if sent_at is null', async () => {
  const notification = {
    id: 'notif-3',
    user_id: 'user-1',
    type: 'SYSTEM',
    channel: 'PUSH',
    title: 'Title 3',
    body: 'Body 3',
    data: null,
    is_read: false,
    sent_at: null,
    created_at: new Date('2026-10-15T10:00:00Z'),
  };

  let updateCalled = false;
  const prismaMock = {
    notifications: {
      findFirst: async () => ({ ...notification }),
      update: async ({ where, data }: any) => {
        updateCalled = true;
        assert.equal(where.id, 'notif-3');
        assert.ok(data.sent_at instanceof Date);
        return { ...notification, sent_at: data.sent_at };
      },
    },
  };

  const service = new NotificationsService(prismaMock as any, {} as any, {} as any, {} as any);
  const result = await service.getMyNotification('user-1', 'notif-3');

  assert.equal(updateCalled, true);
  assert.ok(result.sentAt instanceof Date);
});

test('markRead updates is_read and sent_at', async () => {
  const notification = {
    id: 'notif-4',
    user_id: 'user-1',
    type: 'SYSTEM',
    channel: 'PUSH',
    title: 'Title 4',
    body: 'Body 4',
    data: null,
    is_read: false,
    sent_at: null,
    created_at: new Date('2026-10-15T10:00:00Z'),
  };

  let updatedData: any = null;
  const prismaMock = {
    notifications: {
      findFirst: async () => ({ ...notification }),
      update: async ({ where, data }: any) => {
        updatedData = data;
        return { ...notification, ...data };
      },
    },
  };

  const service = new NotificationsService(prismaMock as any, {} as any, {} as any, {} as any);
  const result = await service.markRead('user-1', 'notif-4');

  assert.equal(updatedData.is_read, true);
  assert.ok(updatedData.sent_at instanceof Date);
  assert.equal(result.isRead, true);
  assert.ok(result.sentAt instanceof Date);
});
