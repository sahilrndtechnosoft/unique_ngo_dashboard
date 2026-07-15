export type PermissionKey = `${string}:${string}`;

export interface AdminMenuItem {
    label: string;
    to: string;
    permission?: PermissionKey;
}

export const adminMenuItems: AdminMenuItem[] = [
    { label: 'Dashboard', to: '/' },
    { label: 'Users', to: '/admin/users', permission: 'USERS:VIEW' },
    { label: 'Sellers', to: '/admin/sellers', permission: 'SELLERS:VIEW' },
    { label: 'Categories', to: '/admin/categories', permission: 'PRODUCTS:VIEW' },
    { label: 'Products', to: '/admin/products', permission: 'PRODUCTS:VIEW' },
    { label: 'Roles & Permissions', to: '/admin/roles', permission: 'ROLES:VIEW' },
    { label: 'Settings', to: '/admin/settings', permission: 'SETTINGS:VIEW' },
];

export function canAccess(
    isSuperAdmin: boolean,
    permissions: string[],
    permission?: PermissionKey,
): boolean {
    if (!permission) return true;
    if (isSuperAdmin) return true;
    return permissions.includes(permission);
}
