import { Injectable, Logger } from '@nestjs/common';
import {
  IssuePartnerVoucherParams,
  IssuePartnerVoucherResult,
  PartnerStoreAdapter,
  RedeemPartnerVoucherParams,
  RedeemPartnerVoucherResult,
  ValidatePartnerVoucherParams,
  ValidatePartnerVoucherResult,
} from './partner-adapter.interface';

@Injectable()
export class PizzaHutPartnerAdapter implements PartnerStoreAdapter {
  readonly adapterType = 'PIZZA_HUT_API';
  private readonly logger = new Logger(PizzaHutPartnerAdapter.name);

  async issueVoucher(params: IssuePartnerVoucherParams): Promise<IssuePartnerVoucherResult> {
    this.logger.log(`[PizzaHutAdapter] Provisioning voucher: code=${params.voucherCode}, value=₹${params.monetaryValue}`);

    if (params.config?.simulateFailure === true) {
      this.logger.warn('[PizzaHutAdapter] Pizza Hut API simulation failure triggered');
      return {
        success: false,
        error: 'Pizza Hut Partner Gateway returned 503 Service Unavailable',
      };
    }

    // Generate Pizza Hut format coupon code e.g. "PH-NGO-200-ABCDEF"
    const promoCode = `PH-${params.voucherCode.replace(/[^A-Za-z0-9]/g, '')}`;
    const partnerReference = `PH-REF-${Date.now()}`;
    const barcodePayload = `https://pizzahut.co.in/voucher/redeem?code=${promoCode}&pin=${params.securityPin || '0000'}`;

    return {
      success: true,
      partnerReference,
      barcodePayload,
      promoCode,
      externalStatus: 'ACTIVE',
      metadata: {
        brand: 'Pizza Hut India',
        applicableOutlets: ['Dine-In', 'Takeaway', 'Delivery'],
        merchantId: (params.config?.merchantId as string) || 'PH-NGO-001',
        terms: 'Valid on medium and large pan pizzas at participating Pizza Hut restaurants across India.',
      },
    };
  }

  async validateVoucher(params: ValidatePartnerVoucherParams): Promise<ValidatePartnerVoucherResult> {
    this.logger.log(`[PizzaHutAdapter] Validating Pizza Hut voucher: ${params.voucherCode}`);
    return {
      isValid: true,
      metadata: {
        brand: 'Pizza Hut India',
        outletVerified: params.storeLocation || 'Online / Pan-India',
      },
    };
  }

  async redeemVoucher(params: RedeemPartnerVoucherParams): Promise<RedeemPartnerVoucherResult> {
    this.logger.log(`[PizzaHutAdapter] Consuming voucher at outlet: ${params.storeLocation || 'Main Store'}`);
    return {
      success: true,
      redeemedAt: new Date(),
      partnerReference: `PH-SETTLED-${Date.now()}`,
      receiptNumber: `PH-BILL-${Math.floor(100000 + Math.random() * 900000)}`,
    };
  }
}
