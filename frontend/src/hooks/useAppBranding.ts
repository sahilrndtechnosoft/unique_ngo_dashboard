import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, IRootState } from '../store';
import { setBranding } from '../store/settingsSlice';
import { api, mediaUrl, unwrap } from '../services/api';

function applyFavicon(path: string | null) {
    const href = path ? mediaUrl(path) : '/favicon.png';
    let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = href;
}

/** Public branding is also available before signing in. */
export function useAppBranding() {
    const dispatch = useDispatch<AppDispatch>();
    const branding = useSelector((state: IRootState) => state.settings);

    useEffect(() => {
        if (branding.loaded) return;

        let cancelled = false;
        api
            .get('/public/settings')
            .then((response) => {
                if (cancelled) return;
                const settings = unwrap<any>(response);
                dispatch(
                    setBranding({
                        companyName: settings.companyName,
                        logoUrl: settings.logoUrl,
                        faviconUrl: settings.faviconUrl,
                    }),
                );
                applyFavicon(settings.faviconUrl ?? null);
            })
            .catch(() => {
                if (!cancelled) {
                    dispatch(setBranding({ companyName: 'Unique NGO', logoUrl: null, faviconUrl: null }));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [branding.loaded, dispatch]);

    useEffect(() => {
        if (branding.loaded) applyFavicon(branding.faviconUrl);
    }, [branding.loaded, branding.faviconUrl]);

    return branding;
}
