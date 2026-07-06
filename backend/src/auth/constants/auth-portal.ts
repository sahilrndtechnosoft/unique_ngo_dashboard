import { UserRole } from '../../common/constants';

export enum AuthPortal {
  USER = 'user',
  ADMIN = 'admin',
  SELLER = 'seller',
}

export const PORTAL_ALLOWED_ROLES: Record<AuthPortal, UserRole[]> = {
  [AuthPortal.USER]: [UserRole.USER, UserRole.PREMIUM_USER],
  [AuthPortal.ADMIN]: [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.MODERATOR,
  ],
  [AuthPortal.SELLER]: [UserRole.SELLER, UserRole.PREMIUM_SELLER],
};

export function isRoleAllowedForPortal(
  role: UserRole,
  portal: AuthPortal,
): boolean {
  return PORTAL_ALLOWED_ROLES[portal].includes(role);
}
