import { FormEvent, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState } from '../../store';
import { setPageTitle } from '../../store/themeConfigSlice';
import { updateUser } from '../../store/authSlice';
import { setBranding } from '../../store/settingsSlice';
import { api, getErrorMessage, mediaUrl, unwrap } from '../../services/api';
import { canAccess } from '../../config/admin-menu';
import { FormField } from '../../components/Admin/FormPrimitives';
import AdminRoles from '../Admin/Roles';
import IconUser from '../../components/Icon/IconUser';
import IconSettings from '../../components/Icon/IconSettings';
import IconLockDots from '../../components/Icon/IconLockDots';
import IconShieldRoles from '../../components/Icon/Menu/IconMenuUsers';

type TabKey = 'profile' | 'app-settings' | 'roles';

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
    const [profileMessage, setProfileMessage] = useState('');

    const [orgForm, setOrgForm] = useState(emptyOrgForm);
    const [banners, setBanners] = useState<any[]>([]);
    const [orgLoading, setOrgLoading] = useState(false);
    const [orgBusy, setOrgBusy] = useState(false);
    const [orgError, setOrgError] = useState('');
    const [orgMessage, setOrgMessage] = useState('');

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
            setProfileError(getErrorMessage(err));
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
            setOrgError(getErrorMessage(err));
        } finally {
            setOrgLoading(false);
        }
    };

    const submitProfile = async (event: FormEvent) => {
        event.preventDefault();
        setProfileBusy(true);
        setProfileError('');
        setProfileMessage('');
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
            setProfileMessage('Profile updated successfully');
        } catch (err) {
            setProfileError(getErrorMessage(err));
        } finally {
            setProfileBusy(false);
        }
    };

    const submitOrgSettings = async (event: FormEvent) => {
        event.preventDefault();
        setOrgBusy(true);
        setOrgError('');
        setOrgMessage('');
        try {
            await api.patch('/admin/settings', {
                companyName: orgForm.companyName || undefined,
                email: orgForm.email || undefined,
                phone: orgForm.phone || undefined,
                addressLine1: orgForm.addressLine1 || undefined,
                footerAbout: orgForm.footerAbout || undefined,
                footerCopyright: orgForm.footerCopyright || undefined,
            });
            setOrgMessage('Settings saved');
            await loadOrgSettings();
        } catch (err) {
            setOrgError(getErrorMessage(err));
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
            setOrgMessage(`${kind} updated`);
            await loadOrgSettings();
        } catch (err) {
            setOrgError(getErrorMessage(err));
        }
    };

    const uploadBanner = async (file?: File | null) => {
        if (!file) return;
        const body = new FormData();
        body.append('file', file);
        try {
            await api.post('/admin/banners', body, { headers: { 'Content-Type': 'multipart/form-data' } });
            await loadOrgSettings();
        } catch (err) {
            setOrgError(getErrorMessage(err));
        }
    };

    const deleteBanner = async (id: string) => {
        if (!confirm('Delete banner?')) return;
        try {
            await api.delete(`/admin/banners/${id}`);
            await loadOrgSettings();
        } catch (err) {
            setOrgError(getErrorMessage(err));
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
                        {profileMessage ? <div className="mb-4 rounded bg-success-light p-3 text-success">{profileMessage}</div> : null}

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
                            {orgMessage ? <div className="mb-4 rounded bg-success-light p-3 text-success">{orgMessage}</div> : null}

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
                            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                                <h6 className="font-semibold text-lg">Banners</h6>
                                <label className="btn btn-success cursor-pointer">
                                    Add Banner
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadBanner(e.target.files?.[0])} />
                                </label>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {banners.map((banner) => (
                                    <div key={banner.id} className="border border-[#ebedf2] dark:border-[#191e3a] rounded p-3">
                                        <img src={mediaUrl(banner.imageUrl)} alt="" className="w-full h-32 object-cover rounded mb-2" />
                                        <button type="button" className="btn btn-sm btn-outline-danger w-full" onClick={() => deleteBanner(banner.id)}>
                                            Delete
                                        </button>
                                    </div>
                                ))}
                                {banners.length === 0 ? <p className="text-white-dark">No banners yet</p> : null}
                            </div>
                        </div>
                    </div>
                ) : null}

                {tab === 'roles' && canManageRoles ? <AdminRoles /> : null}
            </div>
        </div>
    );
};

export default Profile;
