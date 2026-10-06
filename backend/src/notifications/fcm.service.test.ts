import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FcmService } from './services/fcm.service';

test('FCM sends tokens in Firebase-sized batches', async () => {
  const service = new FcmService({} as any);
  const batches: string[][] = [];
  (service as any).getMessagingClient = () => ({
    sendEachForMulticast: async (message: { tokens: string[] }) => {
      batches.push(message.tokens);
      return { responses: message.tokens.map(() => ({ success: true })) };
    },
  });

  const tokens = Array.from({ length: 1205 }, (_, index) => `token-${index}`);
  const result = await service.sendToTokens(tokens, { title: 'Hello', body: 'World' });

  assert.deepEqual(batches.map((batch) => batch.length), [500, 500, 205]);
  assert.equal(result.successTokens.length, 1205);
});
