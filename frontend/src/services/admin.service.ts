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

    listSellers: (params?: Record<string, unknown>) =>
        api.get('/admin/sellers', { params }).then((r) => unwrap<Paginated<any>>(r)),
    getSeller: (id: string) => api.get(`/admin/sellers/${id}`).then((r) => unwrap(r)),
    createSeller: (body: Record<string, unknown>) =>
        api.post('/admin/sellers', body).then((r) => unwrap(r)),
    updateSeller: (id: string, body: Record<string, unknown>) =>
        api.patch(`/admin/sellers/${id}`, body).then((r) => unwrap(r)),
    deleteSeller: (id: string) => api.delete(`/admin/sellers/${id}`).then((r) => unwrap(r)),

    listCategories: (params?: Record<string, unknown>) =>
        api.get('/admin/categories', { params }).then((r) => unwrap<Paginated<any>>(r)),
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
};
