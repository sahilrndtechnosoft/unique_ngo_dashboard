import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3000';

export const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('unique_ngo_access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function flushQueue(token: string | null) {
    refreshQueue.forEach((cb) => cb(token));
    refreshQueue = [];
}

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        if (error.response?.status !== 401 || !original || original._retry) {
            return Promise.reject(error);
        }

        const refreshToken = localStorage.getItem('unique_ngo_refresh_token');
        if (!refreshToken) {
            localStorage.clear();
            window.location.href = '/auth/boxed-signin';
            return Promise.reject(error);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                refreshQueue.push((token) => {
                    if (!token) {
                        reject(error);
                        return;
                    }
                    original.headers.Authorization = `Bearer ${token}`;
                    resolve(api(original));
                });
            });
        }

        original._retry = true;
        isRefreshing = true;

        try {
            const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
            const payload = data?.data ?? data;
            const accessToken = payload.accessToken as string;
            const newRefresh = payload.refreshToken as string;
            localStorage.setItem('unique_ngo_access_token', accessToken);
            localStorage.setItem('unique_ngo_refresh_token', newRefresh);
            flushQueue(accessToken);
            original.headers.Authorization = `Bearer ${accessToken}`;
            return api(original);
        } catch (refreshError) {
            flushQueue(null);
            localStorage.removeItem('unique_ngo_access_token');
            localStorage.removeItem('unique_ngo_refresh_token');
            localStorage.removeItem('unique_ngo_user');
            window.location.href = '/auth/boxed-signin';
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    },
);

export function unwrap<T = unknown>(response: { data: { data?: T; success?: boolean; message?: string } }): T {
    const body = response.data;
    return (body?.data ?? body) as T;
}

export function mediaUrl(path: string | null | undefined): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: string; errors?: string[] } | undefined;
        if (data?.errors?.length) return data.errors.join(', ');
        if (data?.message) return data.message;
    }
    if (error instanceof Error) return error.message;
    return fallback;
}
