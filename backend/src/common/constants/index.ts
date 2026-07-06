export enum UserRole {
  USER = 'USER',
  SELLER = 'SELLER',
  PREMIUM_USER = 'PREMIUM_USER',
  PREMIUM_SELLER = 'PREMIUM_SELLER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  MODERATOR = 'MODERATOR',
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email?: string | null;
  mobile?: string | null;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors: string[];
}

export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export const MAX_PROFILE_PICTURE_SIZE = 5 * 1024 * 1024; // 5MB
