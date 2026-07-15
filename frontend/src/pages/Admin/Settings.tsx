import { FormEvent, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { setBranding } from '../../store/settingsSlice';
import { api, getErrorMessage, mediaUrl, unwrap } from '../../services/api';
import { FormField } from '../../components/Admin/FormPrimitives';

export default function AdminSettings() {
    const dispatch = useDispatch();
    const [form, setForm] = useState({
        companyName: '',
        email: '',
        phone: '',
        addressLine1: '',
        footerAbout: '',
        footerCopyright: '',
        logoUrl: '',
        faviconUrl: '',
    });
    const [banners, setBanners] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const applyBranding = (settings: { companyName?: string; logoUrl?: string | null; faviconUrl?: string | null }) => {
        dispatch(
            setBranding({
                companyName: settings.companyName,
                logoUrl: settings.logoUrl ?? null,
                faviconUrl: settings.faviconUrl ?? null,
            }),
        );
    };

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [settings, bannerList] = await Promise.all([
                api.get('/admin/settings').then((r) => unwrap<any>(r)),
                api.get('/admin/banners').then((r) => unwrap<any[]>(r)),
            ]);
            setForm({
                companyName: settings.companyName ?? '',
                email: settings.email ?? '',
                phone: settings.phone ?? '',
                addressLine1: settings.addressLine1 ?? '',
                footerAbout: settings.footerAbout ?? '',
                footerCopyright: settings.footerCopyright ?? '',
                logoUrl: settings.logoUrl ?? '',
                faviconUrl: settings.faviconUrl ?? '',
            });
            setBanners(Array.isArray(bannerList) ? bannerList : []);
            applyBranding(settings);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        dispatch(setPageTitle('Settings'));
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setMessage('');
        try {
            await api.patch('/admin/settings', {
                companyName: form.companyName || undefined,
                email: form.email || undefined,
                phone: form.phone || undefined,
                addressLine1: form.addressLine1 || undefined,
                footerAbout: form.footerAbout || undefined,
                footerCopyright: form.footerCopyright || undefined,
            });
            setMessage('Settings saved');
            await load();
        } catch (err) {
            setError(getErrorMessage(err));
        }
    };

    const uploadAsset = async (kind: 'logo' | 'favicon', file?: File | null) => {
        if (!file) return;
        const body = new FormData();
        body.append('file', file);
        try {
            await api.post(`/admin/settings/${kind}`, body, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setMessage(`${kind} updated`);
            await load();
        } catch (err) {
            setError(getErrorMessage(err));
        }
    };

    const uploadBanner = async (file?: File | null) => {
        if (!file) return;
        const body = new FormData();
        body.append('file', file);
        try {
            await api.post('/admin/banners', body, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            await load();
        } catch (err) {
            setError(getErrorMessage(err));
        }
    };

    const deleteBanner = async (id: string) => {
        if (!confirm('Delete banner?')) return;
        try {
            await api.delete(`/admin/banners/${id}`);
            await load();
        } catch (err) {
            setError(getErrorMessage(err));
        }
    };

    return (
        <div>
            <div className="mb-5">
                <h2 className="text-xl font-semibold dark:text-white-light">App Settings & Banners</h2>
                <p className="text-white-dark text-sm mt-1">Logo and favicon appear in the sidebar and browser tab</p>
            </div>
            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}
            {message ? <div className="mb-4 rounded bg-success-light p-3 text-success">{message}</div> : null}

            <div className="panel mb-5">
                {loading ? (
                    <p>Loading...</p>
                ) : (
                    <form onSubmit={submit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <FormField label="Company Name">
                                <input className="form-input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                            </FormField>
                            <FormField label="Email">
                                <input className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                            </FormField>
                            <FormField label="Phone">
                                <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                            </FormField>
                            <FormField label="Address">
                                <input className="form-input" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
                            </FormField>
                            <FormField label="Footer About" className="md:col-span-2">
                                <textarea className="form-textarea min-h-[100px]" value={form.footerAbout} onChange={(e) => setForm({ ...form, footerAbout: e.target.value })} />
                            </FormField>
                            <FormField label="Footer Copyright" className="md:col-span-2">
                                <input className="form-input" value={form.footerCopyright} onChange={(e) => setForm({ ...form, footerCopyright: e.target.value })} />
                            </FormField>
                            <FormField label="Logo">
                                <div className="flex items-center gap-4">
                                    {form.logoUrl ? <img src={mediaUrl(form.logoUrl)} alt="logo" className="h-12 object-contain" /> : null}
                                    <input type="file" accept="image/*" className="form-input" onChange={(e) => uploadAsset('logo', e.target.files?.[0])} />
                                </div>
                            </FormField>
                            <FormField label="Favicon">
                                <div className="flex items-center gap-4">
                                    {form.faviconUrl ? <img src={mediaUrl(form.faviconUrl)} alt="favicon" className="h-8 object-contain" /> : null}
                                    <input type="file" accept="image/*" className="form-input" onChange={(e) => uploadAsset('favicon', e.target.files?.[0])} />
                                </div>
                            </FormField>
                        </div>
                        <div className="flex justify-end mt-6">
                            <button type="submit" className="btn btn-primary">
                                Save Settings
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className="panel">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                    <h6 className="font-semibold text-lg">Banners</h6>
                    <label className="btn btn-success cursor-pointer">
                        Add Banner
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadBanner(e.target.files?.[0])} />
                    </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {banners.map((banner) => (
                        <div key={banner.id} className="border border-[#ebedf2] dark:border-[#191e3a] rounded p-3">
                            <img src={mediaUrl(banner.imageUrl)} alt="" className="w-full h-32 object-cover rounded mb-2" />
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteBanner(banner.id)}>
                                Delete
                            </button>
                        </div>
                    ))}
                    {banners.length === 0 ? <p className="text-white-dark">No banners yet</p> : null}
                </div>
            </div>
        </div>
    );
}
