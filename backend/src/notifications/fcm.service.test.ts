import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FcmService } from './services/fcm.service';

test('FCM sends tokens in Firebase-sized batches', async () => {
  const service = new FcmService({} as any);
  const messages: Array<{ tokens: string[]; notification?: { imageUrl?: string }; data?: Record<string, string>; android?: { priority?: string; notification?: { channelId?: string; imageUrl?: string } } }> = [];
  (service as any).getMessagingClient = () => ({
    sendEachForMulticast: async (message: { tokens: string[]; notification?: { imageUrl?: string }; data?: Record<string, string>; android?: { priority?: string; notification?: { channelId?: string; imageUrl?: string } } }) => {
      messages.push(message);
      return { responses: message.tokens.map((_, index) => ({ success: true, messageId: `message-${index}` })) };
    },
  });

  const tokens = Array.from({ length: 1205 }, (_, index) => `token-${index}`);
  const result = await service.sendToTokens(tokens, { title: 'Hello', body: 'World', imageUrl: 'https://example.com/notification.png' });

  assert.deepEqual(messages.map((message) => message.tokens.length), [500, 500, 205]);
  assert.ok(messages.every((message) => message.android?.priority === 'high'));
  assert.ok(messages.every((message) => message.android?.notification?.channelId === 'high_importance_channel'));
  assert.ok(messages.every((message) => message.notification?.imageUrl === 'https://example.com/notification.png'));
  assert.ok(messages.every((message) => message.android?.notification?.imageUrl === 'https://example.com/notification.png'));
  assert.ok(messages.every((message) => message.data?.imageUrl === 'https://example.com/notification.png'));
  assert.equal(result.successTokens.length, 1205);
  assert.equal(result.messageIds.length, 1205);
});
