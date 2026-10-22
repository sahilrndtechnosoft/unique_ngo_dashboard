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
export class MockPartnerAdapter implements PartnerStoreAdapter {
  readonly adapterType = 'MOCK';
  private readonly logger = new Logger(MockPartnerAdapter.name);

  async issueVoucher(params: IssuePartnerVoucherParams): Promise<IssuePartnerVoucherResult> {
    this.logger.log(`[MockPartner] Issuing voucher for ${params.partnerStoreSlug}: code=${params.voucherCode}, value=₹${params.monetaryValue}`);

    // If config has simulateFailure = true, simulate an upstream partner error
    if (params.config?.simulateFailure === true) {
      this.logger.warn(`[MockPartner] Simulated partner outage/failure for ${params.partnerStoreSlug}`);
      return {
        success: false,
        error: 'Simulated partner API timeout/error',
      };
    }

    const partnerReference = `MOCK-REF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const barcodePayload = `BARCODE:${params.partnerStoreSlug.toUpperCase()}:${params.voucherCode}`;

    return {
      success: true,
      partnerReference,
      barcodePayload,
      promoCode: params.voucherCode,
      externalStatus: 'ACTIVE',
      metadata: {
        partnerIssuedAt: new Date().toISOString(),
        storeSlug: params.partnerStoreSlug,
        mockProvider: true,
      },
    };
  }

  async validateVoucher(params: ValidatePartnerVoucherParams): Promise<ValidatePartnerVoucherResult> {
    this.logger.log(`[MockPartner] Validating voucher: code=${params.voucherCode}`);
    return {
      isValid: true,
      partnerReference: `MOCK-REF-${params.voucherCode}`,
      metadata: { validatedAt: new Date().toISOString() },
    };
  }

  async redeemVoucher(params: RedeemPartnerVoucherParams): Promise<RedeemPartnerVoucherResult> {
    this.logger.log(`[MockPartner] Redeeming voucher at ${params.storeLocation || 'store'}: code=${params.voucherCode}`);
    return {
      success: true,
      redeemedAt: new Date(),
      partnerReference: `MOCK-REDEEM-${params.voucherCode}`,
      receiptNumber: `RCPT-${Date.now()}`,
    };
  }
}
