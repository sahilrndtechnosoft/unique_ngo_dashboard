import { api, unwrap } from './api';
import type { AuthUser } from '../store/authSlice';

export async function adminLogin(email: string, password: string) {
    const response = await api.post('/auth/admin/login', { email, password });
    return unwrap<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
    }>(response);
}

export async function fetchMyPermissions() {
    const response = await api.get('/users/me/permissions');
    return unwrap<{
        role: string;
        isSuperAdmin: boolean;
        permissions: Array<{ module: string; action: string; key: string }>;
    }>(response);
}

export async function logout(refreshToken: string) {
    await api.post('/auth/logout', { refreshToken });
}
