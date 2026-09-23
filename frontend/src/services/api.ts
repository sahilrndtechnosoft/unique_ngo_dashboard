import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3017/api/v1';
export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3017';

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

export function unwrap<T = unknown>(response: { data?: unknown }): T {
    let body = response?.data;
    for (let depth = 0; depth < 4; depth += 1) {
        if (!body || typeof body !== 'object') break;
        const envelope = body as { data?: unknown; success?: unknown };
        if (envelope.success !== true || !('data' in envelope)) break;
        body = envelope.data;
    }
    return body as T;
}

export function unwrapArray<T>(response: { data?: unknown }): T[] {
    const payload = unwrap<unknown>(response);
    if (Array.isArray(payload)) return payload as T[];
    if (payload == null) return [];
    if (typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)) {
        return (payload as { items: T[] }).items;
    }
    throw new Error('The server returned an unexpected list response. Please reload and try again.');
}

export function unwrapPaginated<T>(response: { data?: unknown }): {
    items: T[];
    meta: { page: number; limit: number; total: number; totalPages: number };
} {
    const payload = unwrap<unknown>(response);
    const result = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as { items?: unknown; meta?: Record<string, unknown> }
        : undefined;
    if (!Array.isArray(payload) && !Array.isArray(result?.items)) {
        throw new Error(typeof payload === 'string' && payload.trimStart().startsWith('<')
            ? 'The API URL returned an HTML page instead of JSON. Check VITE_API_URL and restart the frontend.'
            : 'The server returned an unexpected list response. Please reload and try again.');
    }
    const items = Array.isArray(payload)
        ? payload as T[]
        : result!.items as T[];
    const meta = result?.meta;
    const numberOr = (value: unknown, fallback: number) => {
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : fallback;
    };
    return {
        items,
        meta: {
            page: numberOr(meta?.page, 1) || 1,
            limit: numberOr(meta?.limit, 20) || 20,
            total: numberOr(meta?.total, items.length),
            totalPages: numberOr(meta?.totalPages, 1) || 1,
        },
    };
}

const PAGINATION_BATCH_SIZE = 20;

export async function fetchAllPages<T>(
    request: (params: Record<string, unknown>) => Promise<{ items: T[]; meta: { totalPages: number } }>,
    params: Record<string, unknown> = {},
): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    let totalPages = 1;
    do {
        const result = await request({ ...params, page, limit: PAGINATION_BATCH_SIZE });
        items.push(...result.items);
        totalPages = Math.max(result.meta.totalPages || 1, 1);
        page += 1;
    } while (page <= totalPages);
    return items;
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
        if (!error.response) return 'Cannot reach the API. Check that the backend service is running, then try again.';
    }
    if (error instanceof Error) return error.message;
    return fallback;
}
