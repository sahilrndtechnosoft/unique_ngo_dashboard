import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
    id: string;
    fullName: string;
    email: string | null;
    mobile: string | null;
    role: string;
    status: string;
    profilePicture?: string | null;
}

export interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    user: AuthUser | null;
    permissions: string[];
    isSuperAdmin: boolean;
}

const ACCESS_KEY = 'unique_ngo_access_token';
const REFRESH_KEY = 'unique_ngo_refresh_token';
const USER_KEY = 'unique_ngo_user';
const PERMS_KEY = 'unique_ngo_permissions';
const SUPER_KEY = 'unique_ngo_is_super_admin';

function loadJson<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

const initialState: AuthState = {
    accessToken: localStorage.getItem(ACCESS_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
    user: loadJson<AuthUser>(USER_KEY),
    permissions: loadJson<string[]>(PERMS_KEY) ?? [],
    isSuperAdmin: localStorage.getItem(SUPER_KEY) === 'true',
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setCredentials(
            state,
            action: PayloadAction<{
                accessToken: string;
                refreshToken: string;
                user: AuthUser;
            }>,
        ) {
            state.accessToken = action.payload.accessToken;
            state.refreshToken = action.payload.refreshToken;
            state.user = action.payload.user;
            localStorage.setItem(ACCESS_KEY, action.payload.accessToken);
            localStorage.setItem(REFRESH_KEY, action.payload.refreshToken);
            localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user));
        },
        setPermissions(
            state,
            action: PayloadAction<{ permissions: string[]; isSuperAdmin: boolean }>,
        ) {
            state.permissions = action.payload.permissions;
            state.isSuperAdmin = action.payload.isSuperAdmin;
            localStorage.setItem(PERMS_KEY, JSON.stringify(action.payload.permissions));
            localStorage.setItem(SUPER_KEY, String(action.payload.isSuperAdmin));
        },
        updateUser(state, action: PayloadAction<Partial<AuthUser>>) {
            if (!state.user) return;
            state.user = { ...state.user, ...action.payload };
            localStorage.setItem(USER_KEY, JSON.stringify(state.user));
        },
        clearAuth(state) {
            state.accessToken = null;
            state.refreshToken = null;
            state.user = null;
            state.permissions = [];
            state.isSuperAdmin = false;
            localStorage.removeItem(ACCESS_KEY);
            localStorage.removeItem(REFRESH_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(PERMS_KEY);
            localStorage.removeItem(SUPER_KEY);
        },
    },
});

export const { setCredentials, setPermissions, updateUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;
