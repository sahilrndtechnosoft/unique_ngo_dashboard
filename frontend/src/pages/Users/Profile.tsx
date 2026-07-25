import { FormEvent, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState } from '../../store';
import { setPageTitle } from '../../store/themeConfigSlice';
import { updateUser } from '../../store/authSlice';
import { setBranding } from '../../store/settingsSlice';
import { api, getErrorMessage, mediaUrl, unwrap } from '../../services/api';
import { canAccess } from '../../config/admin-menu';
import { confirmAction, showAlert } from '../../utils/alerts';
import { FormField } from '../../components/Admin/FormPrimitives';
import AdminRoles from '../Admin/Roles';
import IconUser from '../../components/Icon/IconUser';
import IconSettings from '../../components/Icon/IconSettings';
import IconLockDots from '../../components/Icon/IconLockDots';
import IconShieldRoles from '../../components/Icon/Menu/IconMenuUsers';
import IconGallery from '../../components/Icon/IconGallery';
import IconTrashLines from '../../components/Icon/IconTrashLines';
import IconPlus from '../../components/Icon/IconPlus';

type TabKey = 'profile' | 'app-settings' | 'roles';

const BANNER_PLACEMENTS = ['HOME', 'CATEGORY', 'PRODUCT', 'CHECKOUT', 'SIDEBAR'];
const BANNER_SLOTS = ['TOP', 'MIDDLE', 'BOTTOM'];

const emptyProfileForm = {
    fullName: '',
    email: '',
    password: '',
    currentPassword: '',
};

const emptyOrgForm = {
    companyName: '',
    email: '',
    phone: '',
    addressLine1: '',
    footerAbout: '',
    footerCopyright: '',
    logoUrl: '',
    faviconUrl: '',
};

const Profile = () => {
    const dispatch = useDispatch();
    const { user, permissions, isSuperAdmin } = useSelector((state: IRootState) => state.auth);
    const canManageOrgSettings = canAccess(isSuperAdmin, permissions, 'SETTINGS:VIEW');
    const canManageRoles = canAccess(isSuperAdmin, permissions, 'ROLES:VIEW');

    const [tab, setTab] = useState<TabKey>('profile');

    const [profileForm, setProfileForm] = useState(emptyProfileForm);
    const [mobile, setMobile] = useState('');
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileBusy, setProfileBusy] = useState(false);
    const [profileError, setProfileError] = useState('');

    const [orgForm, setOrgForm] = useState(emptyOrgForm);
    const [banners, setBanners] = useState<any[]>([]);
    const [bannerForm, setBannerForm] = useState({ title: '', subtitle: '', description: '', placement: 'HOME', slot: 'TOP' });
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [bannerBusy, setBannerBusy] = useState(false);
    const [orgLoading, setOrgLoading] = useState(false);
    const [orgBusy, setOrgBusy] = useState(false);
    const [orgError, setOrgError] = useState('');

    useEffect(() => {
        dispatch(setPageTitle('Account Settings'));
        loadProfile();
        if (canManageOrgSettings) loadOrgSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadProfile = async () => {
        setProfileLoading(true);
        setProfileError('');
        try {
            const profile = await api.get('/users/me').then((r) => unwrap<any>(r));
            setProfileForm({
                fullName: profile.fullName ?? '',
                email: profile.email ?? '',
                password: '',
                currentPassword: '',
            });
            setMobile(profile.mobile ?? '');
            setProfilePicture(profile.profilePicture ?? null);
        } catch (err) {
            const message = getErrorMessage(err);
            setProfileError(message);
            showAlert(message, 'error');
        } finally {
            setProfileLoading(false);
        }
    };

    const loadOrgSettings = async () => {
        setOrgLoading(true);
        setOrgError('');
        try {
            const [settings, bannerList] = await Promise.all([
                api.get('/admin/settings').then((r) => unwrap<any>(r)),
                api.get('/admin/banners').then((r) => unwrap<any[]>(r)),
            ]);
            setOrgForm({
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
            dispatch(
                setBranding({
                    companyName: settings.companyName,
                    logoUrl: settings.logoUrl ?? null,
                    faviconUrl: settings.faviconUrl ?? null,
                }),
            );
        } catch (err) {
            const message = getErrorMessage(err);
            setOrgError(message);
            showAlert(message, 'error');
        } finally {
            setOrgLoading(false);
        }
    };

    const submitProfile = async (event: FormEvent) => {
        event.preventDefault();
        setProfileBusy(true);
        setProfileError('');
        try {
            const body: Record<string, unknown> = {
                fullName: profileForm.fullName,
                email: profileForm.email,
            };
            if (profileForm.password) {
                body.password = profileForm.password;
                body.currentPassword = profileForm.currentPassword;
            }
            const updated = await api.patch('/users/me', body).then((r) => unwrap<any>(r));

            let nextProfilePicture = profilePicture;
            if (pendingAvatar) {
                const form = new FormData();
                form.append('file', pendingAvatar);
                const avatarResult = await api
                    .post('/users/me/profile-picture', form, { headers: { 'Content-Type': 'multipart/form-data' } })
                    .then((r) => unwrap<{ profilePicture: string }>(r));
                nextProfilePicture = avatarResult.profilePicture;
                setProfilePicture(nextProfilePicture);
                setPendingAvatar(null);
            }

            dispatch(
                updateUser({
                    fullName: updated.fullName,
                    email: updated.email,
                    profilePicture: nextProfilePicture,
                }),
            );
            setProfileForm((prev) => ({ ...prev, password: '', currentPassword: '' }));
            showAlert('Profile updated successfully');
        } catch (err) {
            const message = getErrorMessage(err);
            setProfileError(message);
            showAlert(message, 'error');
        } finally {
            setProfileBusy(false);
        }
    };

    const submitOrgSettings = async (event: FormEvent) => {
        event.preventDefault();
        setOrgBusy(true);
        setOrgError('');
        try {
            await api.patch('/admin/settings', {
                companyName: orgForm.companyName || undefined,
                email: orgForm.email || undefined,
                phone: orgForm.phone || undefined,
                addressLine1: orgForm.addressLine1 || undefined,
                footerAbout: orgForm.footerAbout || undefined,
                footerCopyright: orgForm.footerCopyright || undefined,
            });
            showAlert('Settings saved successfully');
            await loadOrgSettings();
        } catch (err) {
            const message = getErrorMessage(err);
            setOrgError(message);
            showAlert(message, 'error');
        } finally {
            setOrgBusy(false);
        }
    };

    const uploadOrgAsset = async (kind: 'logo' | 'favicon', file?: File | null) => {
        if (!file) return;
        const body = new FormData();
        body.append('file', file);
        try {
            await api.post(`/admin/settings/${kind}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
            showAlert(`${kind === 'logo' ? 'Logo' : 'Favicon'} updated successfully`);
            await loadOrgSettings();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const uploadBanner = async (event: FormEvent) => {
        event.preventDefault();
        if (!bannerFile) return;
        setBannerBusy(true);
        const body = new FormData();
        body.append('file', bannerFile);
        if (bannerForm.title) body.append('title', bannerForm.title);
        if (bannerForm.subtitle) body.append('subtitle', bannerForm.subtitle);
        if (bannerForm.description) body.append('description', bannerForm.description);
        body.append('placement', bannerForm.placement);
        body.append('slot', bannerForm.slot);
        try {
            await api.post('/admin/banners', body, { headers: { 'Content-Type': 'multipart/form-data' } });
            setBannerForm({ title: '', subtitle: '', description: '', placement: 'HOME', slot: 'TOP' });
            setBannerFile(null);
            showAlert('Banner added successfully');
            await loadOrgSettings();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBannerBusy(false);
        }
    };

    const deleteBanner = async (id: string) => {
        const ok = await confirmAction('Delete banner?', 'This banner will be permanently removed.');
        if (!ok) return;
        try {
            await api.delete(`/admin/banners/${id}`);
            showAlert('Banner deleted successfully');
            await loadOrgSettings();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    return (
        <div>
            <ul className="flex space-x-2 rtl:space-x-reverse">
                <li>
                    <span className="text-primary">Dashboard</span>
                </li>
                <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                    <span>Account Settings</span>
                </li>
            </ul>

            <div className="pt-5">
                <h2 className="text-xl font-semibold dark:text-white-light mb-5">Account Settings</h2>

                <ul className="sm:flex font-semibold border-b border-[#ebedf2] dark:border-[#191e3a] mb-5 whitespace-nowrap overflow-y-auto">
                    <li className="inline-block">
                        <button
                            type="button"
                            onClick={() => setTab('profile')}
                            className={`flex gap-2 p-4 border-b-2 border-transparent hover:border-primary hover:text-primary ${tab === 'profile' ? '!border-primary text-primary' : ''}`}
                        >
                            <IconUser className="w-5 h-5" />
                            My Profile
                        </button>
                    </li>
                    {canManageOrgSettings ? (
                        <li className="inline-block">
                            <button
                                type="button"
                                onClick={() => setTab('app-settings')}
                                className={`flex gap-2 p-4 border-b-2 border-transparent hover:border-primary hover:text-primary ${tab === 'app-settings' ? '!border-primary text-primary' : ''}`}
                            >
                                <IconSettings className="w-5 h-5" />
                                App Settings &amp; Banners
                            </button>
                        </li>
                    ) : null}
                    {canManageRoles ? (
                        <li className="inline-block">
                            <button
                                type="button"
                                onClick={() => setTab('roles')}
                                className={`flex gap-2 p-4 border-b-2 border-transparent hover:border-primary hover:text-primary ${tab === 'roles' ? '!border-primary text-primary' : ''}`}
                            >
                                <IconShieldRoles className="w-5 h-5" />
                                Roles &amp; Permissions
                            </button>
                        </li>
                    ) : null}
                </ul>

                {tab === 'profile' ? (
                    <div className="panel">
                        <h5 className="font-semibold text-lg dark:text-white-light mb-5">My Profile</h5>

                        {profileError ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{profileError}</div> : null}

                        {profileLoading ? (
                            <p>Loading...</p>
                        ) : (
                            <form onSubmit={submitProfile} className="flex flex-col sm:flex-row gap-8">
                                <div className="flex flex-col items-center sm:w-40 shrink-0">
                                    {pendingAvatar ? (
                                        <img src={URL.createObjectURL(pendingAvatar)} alt="" className="w-28 h-28 rounded-full object-cover mb-4" />
                                    ) : profilePicture ? (
                                        <img src={mediaUrl(profilePicture)} alt={profileForm.fullName} className="w-28 h-28 rounded-full object-cover mb-4" />
                                    ) : (
                                        <div className="w-28 h-28 rounded-full mb-4 grid place-content-center bg-primary-light dark:bg-primary text-primary dark:text-primary-light">
                                            <IconUser className="w-14 h-14" />
                                        </div>
                                    )}
                                    <label className="btn btn-outline-primary btn-sm cursor-pointer">
                                        Change Photo
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => setPendingAvatar(e.target.files?.[0] ?? null)} />
                                    </label>
                                </div>

                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <FormField label="Full Name" required>
                                        <input
                                            className="form-input"
                                            required
                                            value={profileForm.fullName}
                                            onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                                        />
                                    </FormField>
                                    <FormField label="Email" required>
                                        <input
                                            className="form-input"
                                            type="email"
                                            required
                                            value={profileForm.email}
                                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                        />
                                    </FormField>
                                    <FormField label="Mobile" hint="Contact an administrator to change your mobile number">
                                        <input className="form-input" disabled value={mobile || '—'} />
                                    </FormField>
                                    <FormField label="Role">
                                        <input className="form-input" disabled value={user?.role ?? ''} />
                                    </FormField>

                                    <div className="md:col-span-2 flex items-center gap-2 pt-2 pb-1 text-white-dark">
                                        <IconLockDots className="w-4 h-4" />
                                        <span className="text-sm font-semibold">Change Password</span>
                                    </div>
                                    <FormField label="New Password" hint="Leave blank to keep current password">
                                        <input
                                            className="form-input"
                                            type="password"
                                            value={profileForm.password}
                                            onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                                        />
                                    </FormField>
                                    {profileForm.password ? (
                                        <FormField label="Current Password" required>
                                            <input
                                                className="form-input"
                                                type="password"
                                                required
                                                value={profileForm.currentPassword}
                                                onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                                            />
                                        </FormField>
                                    ) : null}

                                    <div className="md:col-span-2 flex justify-end">
                                        <button type="submit" className="btn btn-primary" disabled={profileBusy}>
                                            {profileBusy ? 'Saving...' : 'Save Profile'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                ) : null}

                {tab === 'app-settings' && canManageOrgSettings ? (
                    <div className="space-y-5">
                        <div className="panel">
                            <div className="mb-5">
                                <h5 className="font-semibold text-lg dark:text-white-light">App Settings</h5>
                                <p className="text-white-dark text-sm mt-1">Logo and favicon appear in the sidebar and browser tab</p>
                            </div>
                            {orgError ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{orgError}</div> : null}

                            {orgLoading ? (
                                <p>Loading...</p>
                            ) : (
                                <form onSubmit={submitOrgSettings}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <FormField label="Company Name">
                                            <input className="form-input" value={orgForm.companyName} onChange={(e) => setOrgForm({ ...orgForm, companyName: e.target.value })} />
                                        </FormField>
                                        <FormField label="Email">
                                            <input className="form-input" value={orgForm.email} onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })} />
                                        </FormField>
                                        <FormField label="Phone">
                                            <input className="form-input" value={orgForm.phone} onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })} />
                                        </FormField>
                                        <FormField label="Footer Copyright">
                                            <input className="form-input" value={orgForm.footerCopyright} onChange={(e) => setOrgForm({ ...orgForm, footerCopyright: e.target.value })} />
                                        </FormField>
                                        <FormField label="Address" className="md:col-span-2">
                                            <textarea
                                                className="form-textarea min-h-[100px]"
                                                value={orgForm.addressLine1}
                                                onChange={(e) => setOrgForm({ ...orgForm, addressLine1: e.target.value })}
                                            />
                                        </FormField>
                                        <FormField label="Footer About" className="md:col-span-2">
                                            <input className="form-input" value={orgForm.footerAbout} onChange={(e) => setOrgForm({ ...orgForm, footerAbout: e.target.value })} />
                                        </FormField>
                                        <FormField label="Logo">
                                            <div className="flex items-center gap-4">
                                                {orgForm.logoUrl ? <img src={mediaUrl(orgForm.logoUrl)} alt="logo" className="h-12 object-contain" /> : null}
                                                <input type="file" accept="image/*" className="form-input" onChange={(e) => uploadOrgAsset('logo', e.target.files?.[0])} />
                                            </div>
                                        </FormField>
                                        <FormField label="Favicon">
                                            <div className="flex items-center gap-4">
                                                {orgForm.faviconUrl ? <img src={mediaUrl(orgForm.faviconUrl)} alt="favicon" className="h-8 object-contain" /> : null}
                                                <input type="file" accept="image/*" className="form-input" onChange={(e) => uploadOrgAsset('favicon', e.target.files?.[0])} />
                                            </div>
                                        </FormField>
                                    </div>
                                    <div className="flex justify-end mt-6">
                                        <button type="submit" className="btn btn-primary" disabled={orgBusy}>
                                            {orgBusy ? 'Saving...' : 'Save Settings'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        <div className="panel">
                            <div className="mb-5">
                                <h5 className="font-semibold text-lg dark:text-white-light">Banners</h5>
                                <p className="text-white-dark text-sm mt-1">Manage promotional banners shown across the site, grouped by page and position</p>
                            </div>

                            <form onSubmit={uploadBanner} className="rounded-lg border border-dashed border-[#ebedf2] dark:border-[#191e3a] p-4 sm:p-5 mb-6 bg-[#fafafa] dark:bg-[#1a2941]">
                                <div className="flex flex-col lg:flex-row gap-5">
                                    <div className="lg:w-56 shrink-0">
                                        <label
                                            className={`flex flex-col items-center justify-center gap-2 w-full h-40 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                                                bannerFile ? 'border-primary p-1' : 'border-[#bfc9d4] dark:border-[#253b5c] hover:border-primary text-white-dark hover:text-primary'
                                            }`}
                                        >
                                            {bannerFile ? (
                                                <img src={URL.createObjectURL(bannerFile)} alt="" className="w-full h-full object-cover rounded" />
                                            ) : (
                                                <>
                                                    <IconGallery className="w-8 h-8" />
                                                    <span className="text-xs font-medium text-center px-2">Click to select banner image</span>
                                                </>
                                            )}
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)} />
                                        </label>
                                        {bannerFile ? (
                                            <button
                                                type="button"
                                                className="text-xs text-danger mt-1.5 hover:underline"
                                                onClick={() => setBannerFile(null)}
                                            >
                                                Remove selected image
                                            </button>
                                        ) : null}
                                    </div>

                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField label="Title">
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={bannerForm.title}
                                                onChange={(e) => setBannerForm((prev) => ({ ...prev, title: e.target.value }))}
                                            />
                                        </FormField>
                                        <FormField label="Subtitle">
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={bannerForm.subtitle}
                                                onChange={(e) => setBannerForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                                            />
                                        </FormField>
                                        <FormField label="Description" className="md:col-span-2">
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={bannerForm.description}
                                                onChange={(e) => setBannerForm((prev) => ({ ...prev, description: e.target.value }))}
                                            />
                                        </FormField>
                                        <FormField label="Placement" hint="Which page the banner appears on">
                                            <select
                                                className="form-select"
                                                value={bannerForm.placement}
                                                onChange={(e) => setBannerForm((prev) => ({ ...prev, placement: e.target.value }))}
                                            >
                                                {BANNER_PLACEMENTS.map((placement) => (
                                                    <option key={placement} value={placement}>
                                                        {placement}
                                                    </option>
                                                ))}
                                            </select>
                                        </FormField>
                                        <FormField label="Slot" hint="Position within the page">
                                            <select
                                                className="form-select"
                                                value={bannerForm.slot}
                                                onChange={(e) => setBannerForm((prev) => ({ ...prev, slot: e.target.value }))}
                                            >
                                                {BANNER_SLOTS.map((slot) => (
                                                    <option key={slot} value={slot}>
                                                        {slot}
                                                    </option>
                                                ))}
                                            </select>
                                        </FormField>

                                        <div className="md:col-span-2 flex justify-end">
                                            <button type="submit" className="btn btn-primary gap-2" disabled={!bannerFile || bannerBusy}>
                                                <IconPlus className="w-4 h-4" />
                                                {bannerBusy ? 'Uploading...' : 'Add Banner'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>

                            <div className="flex items-center justify-between mb-4">
                                <h6 className="font-semibold text-white-dark text-sm uppercase tracking-wide">
                                    Existing Banners {banners.length ? `(${banners.length})` : ''}
                                </h6>
                            </div>

                            {banners.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-10 text-white-dark border border-dashed border-[#ebedf2] dark:border-[#191e3a] rounded-lg">
                                    <IconGallery className="w-8 h-8 opacity-50" />
                                    <p className="text-sm">No banners yet — add one above</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                    {banners.map((banner) => (
                                        <div
                                            key={banner.id}
                                            className="group relative rounded-lg border border-[#ebedf2] dark:border-[#191e3a] overflow-hidden bg-white dark:bg-[#0e1726] shadow-sm hover:shadow-md transition-shadow"
                                        >
                                            <div className="relative">
                                                <img src={mediaUrl(banner.imageUrl)} alt="" className="w-full aspect-video object-cover" />
                                                <button
                                                    type="button"
                                                    title="Delete banner"
                                                    className="absolute top-2 right-2 grid place-content-center w-8 h-8 rounded-full bg-white/90 dark:bg-[#0e1726]/90 text-danger opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                                    onClick={() => deleteBanner(banner.id)}
                                                >
                                                    <IconTrashLines className="w-4 h-4" />
                                                </button>
                                                <div className="absolute bottom-2 left-2 flex gap-1.5">
                                                    {banner.placement ? <span className="badge badge-outline-primary bg-white/90 dark:bg-[#0e1726]/90">{banner.placement}</span> : null}
                                                    {banner.slot ? <span className="badge badge-outline-secondary bg-white/90 dark:bg-[#0e1726]/90">{banner.slot}</span> : null}
                                                </div>
                                            </div>
                                            <div className="p-3">
                                                {banner.title ? <p className="font-semibold text-sm truncate">{banner.title}</p> : <p className="text-sm text-white-dark italic">Untitled banner</p>}
                                                {banner.subtitle ? <p className="text-xs text-white-dark truncate mt-0.5">{banner.subtitle}</p> : null}
                                                {banner.description ? <p className="text-xs text-white-dark mt-1 line-clamp-2">{banner.description}</p> : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}

                {tab === 'roles' && canManageRoles ? <AdminRoles /> : null}
            </div>
        </div>
    );
};

export default Profile;
