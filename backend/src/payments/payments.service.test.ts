import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { payment_status } from '../../generated/prisma/client';
import { PaymentsService } from './payments.service';

test('Razorpay webhook verifies its signature and applies a capture once', async () => {
  const body = Buffer.from(JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { order_id: 'rzp-order', id: 'rzp-payment', amount: 10500, currency: 'INR' } } },
  }));
  const signature = createHmac('sha256', 'webhook-secret').update(body).digest('hex');
  let payment = {
    id: 'payment-id',
    reference_id: 'order-id',
    amount: 105,
    currency: 'INR',
    status: payment_status.PENDING,
    gateway_payment_id: null,
  };
  let updates = 0;
  const tx = {
    payments: {
      findUnique: async () => payment,
      update: async ({ data }: any) => {
        payment = { ...payment, ...data };
        updates += 1;
        return payment;
      },
    },
    orders: { updateMany: async () => ({ count: 1 }) },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as import('../prisma/prisma.service').PrismaService;
  const config = { get: (key: string) => ({
    'app.razorpay.keyId': 'key-id',
    'app.razorpay.keySecret': 'key-secret',
    'app.razorpay.webhookSecret': 'webhook-secret',
  } as Record<string, string | undefined>)[key] };
  const service = new PaymentsService(prisma, config as never);

  await service.handleWebhook(body, signature);
  await service.handleWebhook(body, signature);
  assert.equal(payment.status, payment_status.SUCCESS);
  assert.equal(updates, 1);
});

test('Razorpay webhook rejects a bad signature before database access', async () => {
  let transactions = 0;
  const prisma = {
    $transaction: async () => { transactions += 1; },
  } as unknown as import('../prisma/prisma.service').PrismaService;
  const config = { get: (key: string) => key === 'app.razorpay.keySecret' ? 'key-secret' : key === 'app.razorpay.webhookSecret' ? 'webhook-secret' : 'key-id' };
  const service = new PaymentsService(prisma, config as never);

  await assert.rejects(service.handleWebhook(Buffer.from('{}'), 'bad-signature'), /Invalid Razorpay signature/);
  assert.equal(transactions, 0);
});
