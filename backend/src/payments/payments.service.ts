import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma, order_status, payment_status } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VerifyRazorpayPaymentDto } from './dto/payment.dto';

type RazorpayOrder = { id: string; amount: number; currency: string; status: string };

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createRazorpayOrder(userId: string, orderId: string) {
    const payment = await this.getOrderPayment(userId, orderId);
    if (payment.method === 'COD' || payment.method === 'CASH') {
      throw new BadRequestException('This order does not require Razorpay payment');
    }
    if (payment.status === payment_status.SUCCESS) {
      throw new ConflictException('Order payment is already complete');
    }

    if (payment.gateway_order_id) {
      return {
        keyId: this.razorpayConfig().keyId,
        orderId: payment.gateway_order_id,
        amount: Number(payment.amount) * 100,
        currency: payment.currency,
      };
    }

    const razorpayOrder = await this.request<RazorpayOrder>('/v1/orders', 'POST', {
      amount: new Prisma.Decimal(payment.amount).mul(100).toNumber(),
      currency: payment.currency,
      receipt: orderId,
      notes: { localOrderId: orderId },
    });
    if (razorpayOrder.amount !== new Prisma.Decimal(payment.amount).mul(100).toNumber()) {
      throw new ConflictException('Razorpay amount does not match the order amount');
    }

    const claimed = await this.prisma.payments.updateMany({
      where: { id: payment.id, gateway_order_id: null, status: { in: [payment_status.PENDING, payment_status.PROCESSING] } },
      data: { gateway: 'RAZORPAY', gateway_order_id: razorpayOrder.id, status: payment_status.PROCESSING },
    });
    const saved = claimed.count
      ? { ...payment, gateway_order_id: razorpayOrder.id, status: payment_status.PROCESSING }
      : await this.prisma.payments.findUniqueOrThrow({ where: { id: payment.id } });

    return {
      keyId: this.razorpayConfig().keyId,
      orderId: saved.gateway_order_id,
      amount: Number(saved.amount) * 100,
      currency: saved.currency,
    };
  }

  async verifyRazorpayPayment(userId: string, dto: VerifyRazorpayPaymentDto) {
    const { keySecret } = this.razorpayConfig();
    const payment = await this.prisma.payments.findFirst({
      where: {
        user_id: userId,
        purpose: 'ORDER',
        gateway_order_id: dto.razorpayOrderId,
      },
    });
    if (!payment) throw new ConflictException('Razorpay order is not linked to this account');
    if (payment.status === payment_status.SUCCESS && payment.gateway_payment_id === dto.razorpayPaymentId) {
      return this.getOrderResult(payment.reference_id);
    }

    const expectedSignature = createHmac('sha256', keySecret)
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');
    this.assertSignature(expectedSignature, dto.razorpaySignature);
    const gatewayPayment = await this.request<{ order_id: string; amount: number; currency: string; status: string }>(
      `/v1/payments/${encodeURIComponent(dto.razorpayPaymentId)}`,
      'GET',
    );
    if (
      gatewayPayment.order_id !== dto.razorpayOrderId ||
      gatewayPayment.amount !== new Prisma.Decimal(payment.amount).mul(100).toNumber() ||
      gatewayPayment.currency !== payment.currency ||
      !['captured', 'authorized'].includes(gatewayPayment.status)
    ) {
      throw new ConflictException('Razorpay payment does not match the order');
    }

    await this.markCaptured(dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature, gatewayPayment);
    return this.getOrderResult(payment.reference_id);
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const secret = this.razorpayConfig().webhookSecret;
    if (!secret || !signature) throw new ConflictException('Invalid Razorpay webhook signature');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    this.assertSignature(expected, signature);

    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      payload?: { payment?: { entity?: { order_id?: string; id?: string; amount?: number; currency?: string; status?: string } } };
    };
    const payment = event.payload?.payment?.entity;
    if (!payment?.order_id || !payment.id) return { ignored: true };
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      await this.markCaptured(payment.order_id, payment.id, signature, payment);
    } else if (event.event === 'payment.failed') {
      await this.markFailed(payment.order_id, payment.id, payment);
    }
    return { accepted: true };
  }

  private async markCaptured(
    gatewayOrderId: string,
    gatewayPaymentId: string,
    signature: string,
    gatewayResponse: object,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payments.findUnique({ where: { gateway_order_id: gatewayOrderId } });
      if (!payment) throw new ConflictException('Razorpay order is not linked to a local payment');
      if (payment.status === payment_status.SUCCESS) {
        if (payment.gateway_payment_id !== gatewayPaymentId) {
          throw new ConflictException('A different Razorpay payment is already recorded for this order');
        }
        return;
      }
      const amount = (gatewayResponse as { amount?: number }).amount;
      const currency = (gatewayResponse as { currency?: string }).currency;
      if (amount !== undefined && (amount !== new Prisma.Decimal(payment.amount).mul(100).toNumber() || currency !== payment.currency)) {
        throw new ConflictException('Razorpay payment amount does not match the order');
      }
      await tx.payments.update({
        where: { id: payment.id },
        data: {
          status: payment_status.SUCCESS,
          gateway_payment_id: gatewayPaymentId,
          gateway_signature: signature,
          gateway_response: gatewayResponse,
          verified_at: new Date(),
          updated_at: new Date(),
        },
      });
      await tx.orders.updateMany({
        where: { id: payment.reference_id, status: order_status.PENDING, payment_status: { in: [payment_status.PENDING, payment_status.PROCESSING] } },
        data: { status: order_status.CONFIRMED, payment_status: payment_status.SUCCESS, updated_at: new Date() },
      });
    });
  }

  private async markFailed(gatewayOrderId: string, gatewayPaymentId: string, response: object) {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payments.findUnique({ where: { gateway_order_id: gatewayOrderId } });
      if (!payment || payment.status === payment_status.SUCCESS || payment.status === payment_status.FAILED) return;
      await tx.payments.update({
        where: { id: payment.id },
        data: {
          status: payment_status.FAILED,
          gateway_payment_id: gatewayPaymentId,
          gateway_response: response,
          failure_reason: 'Razorpay payment failed',
          updated_at: new Date(),
        },
      });
      const order = await tx.orders.findUnique({ where: { id: payment.reference_id } });
      if (!order || order.status !== order_status.PENDING) return;
      const items = await tx.order_items.findMany({ where: { order_id: order.id } });
      for (const item of items) {
        if (item.variant_id) {
          await tx.product_variants.update({ where: { id: item.variant_id }, data: { stock_quantity: { increment: item.quantity } } });
        } else {
          await tx.products.update({ where: { id: item.product_id }, data: { stock_quantity: { increment: item.quantity } } });
        }
      }
      await tx.product_inventory_logs.createMany({
        data: items.map((item) => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          change: item.quantity,
          reason: 'PAYMENT_FAILED',
          reference_type: 'ORDER',
          reference_id: order.id,
        })),
      });
      await tx.orders.update({
        where: { id: order.id },
        data: { status: order_status.CANCELLED, payment_status: payment_status.FAILED, cancel_reason: 'Razorpay payment failed', cancelled_at: new Date(), updated_at: new Date() },
      });
    });
  }

  private async getOrderPayment(userId: string, orderId: string) {
    const payment = await this.prisma.payments.findFirst({
      where: { user_id: userId, purpose: 'ORDER', reference_type: 'ORDER', reference_id: orderId },
    });
    if (!payment) throw new ConflictException('Payment record not found for this order');
    return payment;
  }

  private async getOrderResult(orderId: string) {
    const order = await this.prisma.orders.findUnique({ select: { id: true, order_number: true, status: true, payment_status: true }, where: { id: orderId } });
    if (!order) throw new ConflictException('Order not found');
    return { orderId: order.id, orderNumber: order.order_number, status: order.status, paymentStatus: order.payment_status };
  }

  private razorpayConfig() {
    const keyId = this.config.get<string>('app.razorpay.keyId');
    const keySecret = this.config.get<string>('app.razorpay.keySecret');
    const webhookSecret = this.config.get<string>('app.razorpay.webhookSecret');
    if (!keyId || !keySecret) throw new ServiceUnavailableException('Razorpay is not configured');
    return { keyId, keySecret, webhookSecret };
  }

  private assertSignature(expected: string, received: string) {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(received, 'utf8');
    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
      throw new ConflictException('Invalid Razorpay signature');
    }
  }

  private async request<T>(path: string, method: 'GET' | 'POST', body?: object) {
    const { keyId, keySecret } = this.razorpayConfig();
    const response = await fetch(`https://api.razorpay.com${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    });
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) throw new ConflictException((responseBody as { error?: { description?: string } }).error?.description ?? 'Razorpay request failed');
    return responseBody as T;
  }
}
