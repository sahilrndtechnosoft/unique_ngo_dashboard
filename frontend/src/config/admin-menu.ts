export type PermissionKey = `${string}:${string}`;

export interface AdminMenuItem {
    label: string;
    to: string;
    permission?: PermissionKey;
}

export interface AdminMenuGroup {
    label: string | null;
    items: AdminMenuItem[];
}

export const adminMenuGroups: AdminMenuGroup[] = [
    {
        label: null,
        items: [{ label: 'Dashboard', to: '/' }],
    },
    {
        label: 'User Management',
        items: [
            { label: 'Users', to: '/admin/users', permission: 'USERS:VIEW' },
            { label: 'Sellers', to: '/admin/sellers', permission: 'SELLERS:VIEW' },
        ],
    },
    {
        label: 'Ecommerce',
        items: [
            { label: 'Categories', to: '/admin/categories', permission: 'PRODUCTS:VIEW' },
            { label: 'Products', to: '/admin/products', permission: 'PRODUCTS:VIEW' },
        ],
    },
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
