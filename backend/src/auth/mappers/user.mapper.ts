import { users, seller_profiles } from '../../../generated/prisma/client';

export interface PublicUserProfile {
  id: string;
  role: string;
  status: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  mobileVerified: boolean;
  emailVerified: boolean;
  profilePicture: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicSellerProfile {
  id: string;
  businessName: string;
  businessType?: string | null;
  description?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  status: string;
  isPremium: boolean;
  rating: number;
  totalSales: number;
  bankAccountNo?: string | null;
  bankIfsc?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  upiId?: string | null;
}

export function toPublicUser(user: users): PublicUserProfile {
  return {
    id: user.id,
    role: user.role,
    status: user.status,
    fullName: user.full_name,
    email: user.email,
    mobile: user.mobile,
    mobileVerified: user.mobile_verified,
    emailVerified: user.email_verified,
    profilePicture: user.profile_image_url,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export function toPublicSeller(
  profile: seller_profiles,
  detailed = false,
): PublicSellerProfile {
  const base: PublicSellerProfile = {
    id: profile.id,
    businessName: profile.business_name,
    status: profile.status,
    isPremium: profile.is_premium,
    rating: Number(profile.rating),
    totalSales: profile.total_sales,
  };

  if (!detailed) {
    return base;
  }

  return {
    ...base,
    businessType: profile.business_type,
    description: profile.description,
    gstNumber: profile.gst_number,
    panNumber: profile.pan_number,
    logoUrl: profile.logo_url,
    bannerUrl: profile.banner_url,
    bankAccountNo: profile.bank_account_no,
    bankIfsc: profile.bank_ifsc,
    bankName: profile.bank_name,
    bankAccountName: profile.bank_account_name,
    upiId: profile.upi_id,
  };
}
