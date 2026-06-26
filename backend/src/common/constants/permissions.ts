import { UserRole } from './index';

export enum Permission {
  USERS_READ = 'users:read',
  USERS_CREATE = 'users:create',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',
  USERS_ASSIGN_ROLE = 'users:assign-role',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.ADMIN]: [
    Permission.USERS_READ,
    Permission.USERS_CREATE,
    Permission.USERS_UPDATE,
    Permission.USERS_DELETE,
    Permission.USERS_ASSIGN_ROLE,
  ],
  [UserRole.MODERATOR]: [Permission.USERS_READ, Permission.USERS_UPDATE],
  [UserRole.USER]: [],
  [UserRole.SELLER]: [],
  [UserRole.PREMIUM_USER]: [],
  [UserRole.PREMIUM_SELLER]: [],
};

/** Lower number = less privilege. Used to restrict role assignment. */
export const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.USER]: 10,
  [UserRole.SELLER]: 20,
  [UserRole.PREMIUM_USER]: 30,
  [UserRole.PREMIUM_SELLER]: 40,
  [UserRole.MODERATOR]: 50,
  [UserRole.ADMIN]: 90,
  [UserRole.SUPER_ADMIN]: 100,
};

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function hasEveryPermission(
  role: UserRole,
  permissions: Permission[],
): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

export function canAssignRole(
  actorRole: UserRole,
  targetRole: UserRole,
): boolean {
  if (actorRole === UserRole.SUPER_ADMIN) {
    return true;
  }

  if (actorRole === UserRole.ADMIN) {
    return ROLE_RANK[targetRole] < ROLE_RANK[UserRole.ADMIN];
  }

  return false;
}

export function getAssignableRoles(actorRole: UserRole): UserRole[] {
  return (Object.values(UserRole) as UserRole[]).filter((role) =>
    canAssignRole(actorRole, role),
  );
}
