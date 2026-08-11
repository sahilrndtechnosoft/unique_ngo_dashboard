import { api, unwrap } from './api';

export interface Paginated<T> {
    items: T[];
    meta: { page: number; limit: number; total: number; totalPages: number };
}

export const adminApi = {
    listUsers: (params?: Record<string, unknown>) =>
        api.get('/admin/users', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getUser: (id: string) => api.get(`/admin/users/${id}`).then((r) => unwrap(r)),
    createUser: (body: Record<string, unknown>) =>
        api.post('/admin/users', body).then((r) => unwrap(r)),
    updateUser: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/users/${id}`, body).then((r) => unwrap(r)),
    deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then((r) => unwrap(r)),
    uploadUserImage: (id: string, file: File) => {
        const form = new FormData();
        form.append('file', file);
        return api
            .post(`/admin/users/${id}/image`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then((r) => unwrap(r));
    },

    listSellers: (params?: Record<string, unknown>) =>
        api.get('/admin/sellers', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getSeller: (id: string) => api.get(`/admin/sellers/${id}`).then((r) => unwrap(r)),
    createSeller: (body: Record<string, unknown>) =>
        api.post('/admin/sellers', body).then((r) => unwrap(r)),
    updateSeller: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/sellers/${id}`, body).then((r) => unwrap(r)),
    deleteSeller: (id: string) => api.delete(`/admin/sellers/${id}`).then((r) => unwrap(r)),
    uploadSellerImage: (id: string, file: File) => {
        const form = new FormData();
        form.append('file', file);
        return api
            .post(`/admin/sellers/${id}/image`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then((r) => unwrap(r));
    },

    listCategories: (params?: Record<string, unknown>) =>
        api.get('/admin/categories', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getCategory: (id: string) => api.get(`/admin/categories/${id}`).then((r) => unwrap(r)),
    createCategory: (body: Record<string, unknown>) =>
        api.post('/admin/categories', body).then((r) => unwrap(r)),
    updateCategory: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/categories/${id}`, body).then((r) => unwrap(r)),
    deleteCategory: (id: string) => api.delete(`/admin/categories/${id}`).then((r) => unwrap(r)),
    uploadCategoryImage: (id: string, file: File) => {
        const form = new FormData();
        form.append('file', file);
        return api
            .post(`/admin/categories/${id}/image`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then((r) => unwrap(r));
    },

    listProducts: (params?: Record<string, unknown>) =>
        api.get('/admin/products', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getProduct: (id: string) => api.get(`/admin/products/${id}`).then((r) => unwrap(r)),
    createProduct: (body: Record<string, unknown>) =>
        api.post('/admin/products', body).then((r) => unwrap(r)),
    updateProduct: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/products/${id}`, body).then((r) => unwrap(r)),
    approveProduct: (id: string) =>
        api.post(`/admin/products/${id}/approve`).then((r) => unwrap(r)),
    rejectProduct: (id: string, reason: string) =>
        api.post(`/admin/products/${id}/reject`, { reason }).then((r) => unwrap(r)),
    deleteProduct: (id: string) => api.delete(`/admin/products/${id}`).then((r) => unwrap(r)),
    uploadProductImage: (id: string, file: File, isPrimary: boolean = false) => {
        const form = new FormData();
        form.append('file', file);
        form.append('isPrimary', isPrimary ? 'true' : 'false');
        return api
            .post(`/admin/products/${id}/images`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then((r) => unwrap(r));
    },
    deleteProductImage: (id: string, imageId: string) =>
        api.delete(`/admin/products/${id}/images/${imageId}`).then((r) => unwrap(r)),

    listOrders: (params?: Record<string, unknown>) =>
        api.get('/admin/orders', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getOrder: (id: string) => api.get(`/admin/orders/${id}`).then((r) => unwrap(r)),
    updateOrderStatus: (id: string, body: { status: string; note?: string; location?: string }) =>
        api.patch(`/admin/orders/${id}/status`, body).then((r) => unwrap(r)),

    listRoles: () => api.get('/admin/roles').then((r) => unwrap<any[]>(r)),
    getRole: (id: string) => api.get(`/admin/roles/${id}`).then((r) => unwrap(r)),
    createRole: (body: Record<string, unknown>) =>
        api.post('/admin/roles', body).then((r) => unwrap(r)),
    updateRole: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/roles/${id}`, body).then((r) => unwrap(r)),
    assignRolePermissions: (id: string, permissionIds: string[]) =>
        api.put(`/admin/roles/${id}/permissions`, { permissionIds }).then((r) => unwrap(r)),
    deleteRole: (id: string) => api.delete(`/admin/roles/${id}`).then((r) => unwrap(r)),

    listPermissions: () => api.get('/admin/permissions').then((r) => unwrap<any[]>(r)),
    getPermissionsCatalog: () =>
        api.get('/admin/permissions/catalog').then((r) => unwrap<any[]>(r)),

    listHospitals: (params?: Record<string, unknown>) =>
        api.get('/admin/hospitals', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getHospital: (id: string) => api.get(`/admin/hospitals/${id}`).then((r) => unwrap(r)),
    createHospital: (body: Record<string, unknown>) =>
        api.post('/admin/hospitals', body).then((r) => unwrap(r)),
    updateHospital: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/hospitals/${id}`, body).then((r) => unwrap(r)),
    deleteHospital: (id: string) => api.delete(`/admin/hospitals/${id}`).then((r) => unwrap(r)),

    listCampaigns: (params?: Record<string, unknown>) =>
        api.get('/admin/campaigns', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getCampaign: (id: string) => api.get(`/admin/campaigns/${id}`).then((r) => unwrap(r)),
    createCampaign: (body: Record<string, unknown>) =>
        api.post('/admin/campaigns', body).then((r) => unwrap(r)),
    updateCampaign: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/campaigns/${id}`, body).then((r) => unwrap(r)),
    deleteCampaign: (id: string) => api.delete(`/admin/campaigns/${id}`).then((r) => unwrap(r)),
    uploadCampaignBanner: (id: string, file: File) => {
        const form = new FormData();
        form.append('file', file);
        return api
            .post(`/admin/campaigns/${id}/banner`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then((r) => unwrap(r));
    },

    listAppointments: (params?: Record<string, unknown>) =>
        api.get('/admin/appointments', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getAppointment: (id: string) => api.get(`/admin/appointments/${id}`).then((r) => unwrap(r)),
    createAppointment: (body: Record<string, unknown>) =>
        api.post('/admin/appointments', body).then((r) => unwrap(r)),
    updateAppointment: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/appointments/${id}`, body).then((r) => unwrap(r)),
    deleteAppointment: (id: string) => api.delete(`/admin/appointments/${id}`).then((r) => unwrap(r)),

    listDonations: (params?: Record<string, unknown>) =>
        api.get('/admin/donations', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getDonation: (id: string) => api.get(`/admin/donations/${id}`).then((r) => unwrap(r)),
    createDonation: (body: Record<string, unknown>, file?: File | null) => {
        const form = new FormData();
        Object.entries(body).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
        });
        if (file) form.append('file', file);
        return api
            .post('/admin/donations', form, { headers: { 'Content-Type': 'multipart/form-data' } })
            .then((r) => unwrap(r));
    },
    updateDonation: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/donations/${id}`, body).then((r) => unwrap(r)),
    deleteDonation: (id: string) => api.delete(`/admin/donations/${id}`).then((r) => unwrap(r)),
    reviewDonation: (id: string, body: { status: string; rejectionReason?: string; adminNote?: string }) =>
        api.patch(`/admin/donations/${id}/status`, body).then((r) => unwrap(r)),

    listDonationSheetRecords: (params?: Record<string, unknown>) =>
        api.get('/admin/donation-sheet-imports', { params }).then((r) => unwrap<Paginated<any>>(r)),
    importDonationSheet: (file: File, hospitalId?: string, campaignId?: string) => {
        const form = new FormData();
        form.append('file', file);
        if (hospitalId) form.append('hospitalId', hospitalId);
        if (campaignId) form.append('campaignId', campaignId);
        return api
            .post('/admin/donation-sheet-imports', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then((r) => unwrap(r));
    },
    getDonationSheetRecord: (id: string) => api.get(`/admin/donation-sheet-imports/${id}`).then((r) => unwrap(r)),
    createDonationSheetRecord: (body: Record<string, unknown>) =>
        api.post('/admin/donation-sheet-imports/manual', body).then((r) => unwrap(r)),
    updateDonationSheetRecord: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/donation-sheet-imports/${id}`, body).then((r) => unwrap(r)),
    deleteDonationSheetRecord: (id: string) =>
        api.delete(`/admin/donation-sheet-imports/${id}`).then((r) => unwrap(r)),
    getDonationSheetRecordCandidates: (id: string) =>
        api.get(`/admin/donation-sheet-imports/${id}/candidates`).then((r) => unwrap<any[]>(r)),
    matchDonationSheetRecord: (id: string, donationId: string) =>
        api.patch(`/admin/donation-sheet-imports/${id}/match`, { donationId }).then((r) => unwrap(r)),

    listBloodRequests: (params?: Record<string, unknown>) =>
        api.get('/admin/blood-requests', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getBloodRequest: (id: string) => api.get(`/admin/blood-requests/${id}`).then((r) => unwrap(r)),
    createBloodRequest: (body: Record<string, unknown>) =>
        api.post('/admin/blood-requests', body).then((r) => unwrap(r)),
    updateBloodRequest: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/blood-requests/${id}`, body).then((r) => unwrap(r)),
    deleteBloodRequest: (id: string) => api.delete(`/admin/blood-requests/${id}`).then((r) => unwrap(r)),

    broadcastNotification: (body: { target: string; bloodGroups?: string[]; userIds?: string[]; title: string; body: string }) =>
        api.post('/admin/notifications/broadcast', body).then((r) => unwrap<{ matchedUsers: number; targeted: number; delivered: number }>(r)),
    listNotifications: (params?: Record<string, unknown>) =>
        api.get('/admin/notifications', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getNotification: (id: string) => api.get(`/admin/notifications/${id}`).then((r) => unwrap(r)),
    deleteNotification: (id: string) => api.delete(`/admin/notifications/${id}`).then((r) => unwrap(r)),

    listCoupons: (params?: Record<string, unknown>) =>
        api.get('/admin/coupons', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getCoupon: (id: string) => api.get(`/admin/coupons/${id}`).then((r) => unwrap(r)),
    getCouponUsages: (id: string) => api.get(`/admin/coupons/${id}/usages`).then((r) => unwrap<any[]>(r)),
    createCoupon: (body: Record<string, unknown>) => api.post('/admin/coupons', body).then((r) => unwrap(r)),
    updateCoupon: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/coupons/${id}`, body).then((r) => unwrap(r)),
    deleteCoupon: (id: string) => api.delete(`/admin/coupons/${id}`).then((r) => unwrap(r)),
};
