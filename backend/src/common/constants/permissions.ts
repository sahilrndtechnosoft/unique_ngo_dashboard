export enum AppModule {
  USERS = 'USERS',
  SELLERS = 'SELLERS',
  PRODUCTS = 'PRODUCTS',
  ORDERS = 'ORDERS',
  DONATIONS = 'DONATIONS',
  BLOOD_BANK = 'BLOOD_BANK',
  EQUIPMENT = 'EQUIPMENT',
  REWARDS = 'REWARDS',
  COUPONS = 'COUPONS',
  MEMBERSHIPS = 'MEMBERSHIPS',
  REPORTS = 'REPORTS',
  ROLES = 'ROLES',
  SETTINGS = 'SETTINGS',
}

export enum PermissionAction {
  VIEW = 'VIEW',
  CREATE = 'CREATE',
  EDIT = 'EDIT',
  DELETE = 'DELETE',
}

export const ALL_APP_MODULES = Object.values(AppModule);
export const ALL_PERMISSION_ACTIONS = Object.values(PermissionAction);

export const MODULE_LABELS: Record<AppModule, string> = {
  [AppModule.USERS]: 'Users',
  [AppModule.SELLERS]: 'Sellers',
  [AppModule.PRODUCTS]: 'Products',
  [AppModule.ORDERS]: 'Orders',
  [AppModule.DONATIONS]: 'Donations',
  [AppModule.BLOOD_BANK]: 'Blood Bank',
  [AppModule.EQUIPMENT]: 'Equipment',
  [AppModule.REWARDS]: 'Rewards',
  [AppModule.COUPONS]: 'Coupons',
  [AppModule.MEMBERSHIPS]: 'Memberships',
  [AppModule.REPORTS]: 'Reports',
  [AppModule.ROLES]: 'Roles & Permissions',
  [AppModule.SETTINGS]: 'Settings',
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  [PermissionAction.VIEW]: 'View',
  [PermissionAction.CREATE]: 'Create',
  [PermissionAction.EDIT]: 'Edit',
  [PermissionAction.DELETE]: 'Delete',
};

export interface PermissionRequirement {
  module: AppModule;
  action: PermissionAction;
}

export interface UserPermission {
  module: AppModule;
  action: PermissionAction;
  key: string;
}

export function buildPermissionKey(
  module: AppModule,
  action: PermissionAction,
): string {
  return `${module}:${action}`;
}

export function parsePermissionKey(key: string): PermissionRequirement | null {
  const [module, action] = key.split(':');
  if (
    ALL_APP_MODULES.includes(module as AppModule) &&
    ALL_PERMISSION_ACTIONS.includes(action as PermissionAction)
  ) {
    return { module: module as AppModule, action: action as PermissionAction };
  }
  return null;
}
