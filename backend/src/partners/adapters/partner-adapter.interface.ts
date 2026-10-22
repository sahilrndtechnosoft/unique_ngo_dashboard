export interface IssuePartnerVoucherParams {
  partnerStoreId: string;
  partnerStoreSlug: string;
  voucherCode: string;
  securityPin?: string;
  monetaryValue: number;
  userId: string;
  userEmail?: string | null;
  userPhone?: string | null;
  catalogItemId?: string;
  catalogItemTitle: string;
  expiresAt: Date;
  config?: Record<string, unknown> | null;
}

export interface IssuePartnerVoucherResult {
  success: boolean;
  partnerReference?: string;
  barcodePayload?: string;
  promoCode?: string;
  externalStatus?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface ValidatePartnerVoucherParams {
  partnerStoreId: string;
  partnerStoreSlug: string;
  voucherCode: string;
  securityPin?: string;
  storeLocation?: string;
  config?: Record<string, unknown> | null;
}

export interface ValidatePartnerVoucherResult {
  isValid: boolean;
  monetaryValue?: number;
  partnerReference?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface RedeemPartnerVoucherParams {
  partnerStoreId: string;
  partnerStoreSlug: string;
  voucherCode: string;
  securityPin?: string;
  storeLocation?: string;
  redeemedByPartnerId?: string;
  config?: Record<string, unknown> | null;
}

export interface RedeemPartnerVoucherResult {
  success: boolean;
  redeemedAt: Date;
  partnerReference?: string;
  receiptNumber?: string;
  errorMessage?: string;
}

export interface PartnerStoreAdapter {
  readonly adapterType: string;
  issueVoucher(params: IssuePartnerVoucherParams): Promise<IssuePartnerVoucherResult>;
  validateVoucher(params: ValidatePartnerVoucherParams): Promise<ValidatePartnerVoucherResult>;
  redeemVoucher(params: RedeemPartnerVoucherParams): Promise<RedeemPartnerVoucherResult>;
}
