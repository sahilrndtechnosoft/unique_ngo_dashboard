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
            { label: 'Orders', to: '/admin/orders', permission: 'ORDERS:VIEW' },
            { label: 'Coupons', to: '/admin/coupons', permission: 'COUPONS:VIEW' },
        ],
    },
    {
        label: 'Blood Bank',
        items: [
            { label: 'Hospitals', to: '/admin/hospitals', permission: 'BLOOD_BANK:VIEW' },
            { label: 'Campaigns', to: '/admin/campaigns', permission: 'BLOOD_BANK:VIEW' },
            { label: 'Appointments', to: '/admin/appointments', permission: 'BLOOD_BANK:VIEW' },
            { label: 'Donations', to: '/admin/blood-donations', permission: 'BLOOD_BANK:VIEW' },
            { label: 'Blood Requests', to: '/admin/blood-requests', permission: 'BLOOD_BANK:VIEW' },
            { label: 'Send Notification', to: '/admin/notifications', permission: 'NOTIFICATIONS:CREATE' },
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
