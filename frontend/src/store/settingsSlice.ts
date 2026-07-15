import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AppBranding {
    companyName: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    loaded: boolean;
}

const initialState: AppBranding = {
    companyName: 'Unique NGO',
    logoUrl: null,
    faviconUrl: null,
    loaded: false,
};

const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        setBranding(
            state,
            action: PayloadAction<{
                companyName?: string | null;
                logoUrl?: string | null;
                faviconUrl?: string | null;
            }>,
        ) {
            if (action.payload.companyName) state.companyName = action.payload.companyName;
            state.logoUrl = action.payload.logoUrl ?? null;
            state.faviconUrl = action.payload.faviconUrl ?? null;
            state.loaded = true;
        },
    },
});

export const { setBranding } = settingsSlice.actions;
export default settingsSlice.reducer;
