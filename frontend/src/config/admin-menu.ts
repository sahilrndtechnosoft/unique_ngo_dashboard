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
    { label: null, items: [{ label: 'Overview', to: '/' }] },
    { label: 'Impact & community', items: [
        { label: 'Blood requests', to: '/admin/blood-requests', permission: 'BLOOD_BANK:VIEW' },
        { label: 'Appointments', to: '/admin/appointments', permission: 'BLOOD_BANK:VIEW' },
        { label: 'Blood donations', to: '/admin/blood-donations', permission: 'BLOOD_BANK:VIEW' },
        { label: 'Item donations', to: '/admin/donation-items', permission: 'DONATIONS:VIEW' },
        { label: 'Campaigns', to: '/admin/campaigns', permission: 'BLOOD_BANK:VIEW' },
        { label: 'Hospitals', to: '/admin/hospitals', permission: 'BLOOD_BANK:VIEW' },
    ] },
    { label: 'Marketplace', items: [
        { label: 'Orders', to: '/admin/orders', permission: 'ORDERS:VIEW' },
        { label: 'Products', to: '/admin/products', permission: 'PRODUCTS:VIEW' },
        { label: 'Sellers', to: '/admin/sellers', permission: 'SELLERS:VIEW' },
        { label: 'Categories', to: '/admin/categories', permission: 'PRODUCTS:VIEW' },
        { label: 'Coupons', to: '/admin/coupons', permission: 'COUPONS:VIEW' },
    ] },
    { label: 'Relationships', items: [
        { label: 'Members', to: '/admin/users', permission: 'USERS:VIEW' },
        { label: 'Inquiries', to: '/admin/inquiries', permission: 'INQUIRIES:VIEW' },
        { label: 'Ideas & feedback', to: '/admin/suggestions', permission: 'SUGGESTIONS:VIEW' },
        { label: 'Communications', to: '/admin/notifications', permission: 'NOTIFICATIONS:CREATE' },
    ] },
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
