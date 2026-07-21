import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage, mediaUrl } from '../../services/api';
import { useRowSelection } from '../../hooks/useRowSelection';
import { AdminDataTable, AdminPageHeader, BulkActionsBar } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';

const ACCOUNT_TYPES = ['USER', 'SELLER', 'ADMIN', 'SUPER_ADMIN'] as const;
const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'PENDING_VERIFICATION'];
const STAFF_ACCOUNT_TYPES = new Set(['ADMIN', 'SUPER_ADMIN']);

type Mode = 'create' | 'edit' | 'view';

const emptyForm = {
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    role: 'USER',
    rbacRoleId: '',
    status: 'ACTIVE',
    profilePicture: '' as string | null,
};

export default function AdminUsers() {
    const dispatch = useDispatch();
    const [items, setItems] = useState<any[]>([]);
    const [rbacRoles, setRbacRoles] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [rbacRoleFilter, setRbacRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<Mode | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [pendingImage, setPendingImage] = useState<File | null>(null);

    const ids = useMemo(() => items.map((item) => item.id), [items]);
    const selection = useRowSelection(ids);
    const isStaffAccount = STAFF_ACCOUNT_TYPES.has(form.role);
    const activeRbacRoles = useMemo(
        () => rbacRoles.filter((role) => role.isActive !== false),
        [rbacRoles],
    );

    const load = async (
        page = 1,
        size = pageSize,
        filters?: {
            search?: string;
            role?: string;
            rbacRoleId?: string;
            status?: string;
        },
    ) => {
        const nextSearch = filters?.search ?? search;
        const nextRole = filters?.role ?? roleFilter;
        const nextRbacRoleId = filters?.rbacRoleId ?? rbacRoleFilter;
        const nextStatus = filters?.status ?? statusFilter;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listUsers({
                page,
                limit: size,
                search: nextSearch || undefined,
                role: nextRole || undefined,
                rbacRoleId: nextRbacRoleId || undefined,
                status: nextStatus || undefined,
            });
            setItems(data.items);
            setMeta(data.meta);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        setSearch('');
        setRoleFilter('');
        setRbacRoleFilter('');
        setStatusFilter('');
        load(1, pageSize, { search: '', role: '', rbacRoleId: '', status: '' });
    };

    useEffect(() => {
        dispatch(setPageTitle('Users'));
        load();
        adminApi
            .listRoles()
            .then((roles) => setRbacRoles(Array.isArray(roles) ? roles : []))
            .catch(() => setRbacRoles([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setPendingImage(null);
        setMode('create');
    };

    const openEdit = (user: any) => {
        setEditingId(user.id);
        setForm({
            fullName: user.fullName ?? '',
            email: user.email ?? '',
            mobile: user.mobile ?? '',
            password: '',
            role: user.role,
            rbacRoleId: user.rbacRole?.id ?? user.rbacRoleId ?? '',
            status: user.status,
            profilePicture: user.profilePicture ?? null,
        });
        setPendingImage(null);
        setMode('edit');
    };

    const openView = (user: any) => {
        openEdit(user);
        setMode('view');
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');

        if (STAFF_ACCOUNT_TYPES.has(form.role) && !form.rbacRoleId) {
            const message = 'RBAC role is required for Admin and Super Admin';
            setError(message);
            showAlert(message, 'error');
            return;
        }

        setBusy(true);
        try {
            const body: Record<string, unknown> = {
                fullName: form.fullName,
                email: form.email,
                role: form.role,
                status: form.status,
                rbacRoleId: STAFF_ACCOUNT_TYPES.has(form.role) ? form.rbacRoleId : null,
            };
            if (form.mobile) body.mobile = form.mobile;
            if (form.password) body.password = form.password;
            let id = editingId;
            if (mode === 'create') {
                if (!form.password) {
                    setError('Password is required for new users');
                    showAlert('Password is required for new users', 'error');
                    return;
                }
                body.password = form.password;
                const created = (await adminApi.createUser(body)) as any;
                id = created?.id;
                showAlert('User created successfully');
            } else if (editingId) {
                await adminApi.updateUser(editingId, body);
                showAlert('User updated successfully');
            }
            if (id && pendingImage) {
                await adminApi.uploadUserImage(id, pendingImage);
            }
            setMode(null);
            selection.clear();
            await load(meta.page, pageSize);
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: string) => {
        const ok = await confirmAction('Delete user?', 'The user will be soft-deleted.');
        if (!ok) return;
        try {
            await adminApi.deleteUser(id);
            showAlert('User deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDelete = async () => {
        if (!selection.selectedIds.length) return;
        const ok = await confirmAction(`Delete ${selection.selectedIds.length} users?`);
        if (!ok) return;
        try {
            for (const id of selection.selectedIds) {
                await adminApi.deleteUser(id);
            }
            selection.clear();
            showAlert('Selected users deleted');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const readOnly = mode === 'view';

    return (
        <div>
            <AdminPageHeader
                title="Users"
                subtitle="Manage account types and staff RBAC roles"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                onClear={clearFilters}
                canClear={Boolean(search || roleFilter || rbacRoleFilter || statusFilter)}
                onCreate={openCreate}
                createLabel="Add User"
                filters={
                    <>
                        <select
                            className="form-select w-full sm:w-auto min-w-[150px] shrink-0"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="">All account types</option>
                            {ACCOUNT_TYPES.map((role) => (
                                <option key={role} value={role}>
                                    {role}
                                </option>
                            ))}
                        </select>
                        <select
                            className="form-select w-full sm:w-auto min-w-[160px] shrink-0"
                            value={rbacRoleFilter}
                            onChange={(e) => setRbacRoleFilter(e.target.value)}
                        >
                            <option value="">All RBAC roles</option>
                            {activeRbacRoles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.name}
                                </option>
                            ))}
                        </select>
                        <select
                            className="form-select w-full sm:w-auto min-w-[140px] shrink-0"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All statuses</option>
                            {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    </>
                }
            />

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

            <BulkActionsBar count={selection.selectedIds.length} onClear={selection.clear} onBulkDelete={bulkDelete} />

            <AdminDataTable
                columns={[
                    {
                        key: 'image',
                        label: 'Photo',
                        render: (row) =>
                            row.profilePicture ? (
                                <img src={mediaUrl(row.profilePicture)} alt={row.fullName} className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                                <span className="text-xs text-white-dark">—</span>
                            ),
                    },
                    {
                        key: 'fullName',
                        label: 'Name',
                        sortable: true,
                        sortValue: (row) => row.fullName,
                        render: (row) => <span className="font-semibold">{row.fullName}</span>,
                    },
                    {
                        key: 'email',
                        label: 'Email',
                        sortable: true,
                        sortValue: (row) => row.email,
                        render: (row) => row.email,
                    },
                    {
                        key: 'mobile',
                        label: 'Mobile',
                        sortable: true,
                        sortValue: (row) => row.mobile,
                        render: (row) => row.mobile || '—',
                    },
                    {
                        key: 'role',
                        label: 'Account type',
                        sortable: true,
                        sortValue: (row) => row.role,
                        render: (row) => row.role,
                    },
                    {
                        key: 'rbacRole',
                        label: 'RBAC role',
                        sortable: true,
                        sortValue: (row) => row.rbacRole?.name,
                        render: (row) => row.rbacRole?.name || '—',
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        sortable: true,
                        sortValue: (row) => row.status,
                        render: (row) => <StatusBadge status={row.status} />,
                    },
                ]}
                rows={items}
                loading={loading}
                selectedIds={selection.selectedIds}
                allSelected={selection.allSelected}
                someSelected={selection.someSelected}
                onToggleAll={selection.toggleAll}
                onToggle={selection.toggle}
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                pageSize={pageSize}
                onPageChange={(page) => load(page, pageSize)}
                onPageSizeChange={(size) => {
                    setPageSize(size);
                    load(1, size);
                }}
                actions={(row) => (
                    <RowActionsMenu
                        actions={[
                            { label: 'View', onClick: () => openView(row) },
                            { label: 'Edit', onClick: () => openEdit(row) },
                            { label: 'Delete', onClick: () => remove(row.id), danger: true },
                        ]}
                    />
                )}
            />

            <AdminFormModal
                open={mode !== null}
                title={mode === 'create' ? 'Create User' : mode === 'edit' ? 'Edit User' : 'View User'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                readOnly={readOnly}
                busy={busy}
                size="lg"
            >
                <FormSection title="Account details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Profile Picture" className="md:col-span-2">
                            <div className="flex items-center gap-4">
                                {form.profilePicture ? (
                                    <img src={mediaUrl(form.profilePicture)} alt="" className="h-16 w-16 rounded-full object-cover" />
                                ) : null}
                                {!readOnly ? (
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="form-input"
                                        onChange={(e) => setPendingImage(e.target.files?.[0] ?? null)}
                                    />
                                ) : null}
                            </div>
                        </FormField>
                        <FormField label="Full Name" required>
                            <input
                                className="form-input"
                                required
                                disabled={readOnly}
                                value={form.fullName}
                                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Email" required>
                            <input
                                className="form-input"
                                type="email"
                                required
                                disabled={readOnly}
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Mobile">
                            <input
                                className="form-input"
                                disabled={readOnly}
                                value={form.mobile}
                                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                            />
                        </FormField>
                        <FormField
                            label="Password"
                            required={mode === 'create'}
                            hint={mode === 'edit' ? 'Leave blank to keep current password' : undefined}
                        >
                            <input
                                className="form-input"
                                type="password"
                                disabled={readOnly}
                                required={mode === 'create'}
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Account type" required hint="">
                            <select
                                className="form-select"
                                disabled={readOnly}
                                value={form.role}
                                onChange={(e) => {
                                    const role = e.target.value;
                                    setForm({
                                        ...form,
                                        role,
                                        rbacRoleId: STAFF_ACCOUNT_TYPES.has(role) ? form.rbacRoleId : '',
                                    });
                                }}
                            >
                                {ACCOUNT_TYPES.map((role) => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Status" required>
                            <select
                                className="form-select"
                                disabled={readOnly}
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value })}
                            >
                                {STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        {isStaffAccount ? (
                            <FormField
                                label="RBAC role"
                                required
                                className="md:col-span-2"
                                hint="Permissions for this staff account come from the selected role"
                            >
                                <select
                                    className="form-select"
                                    disabled={readOnly}
                                    required
                                    value={form.rbacRoleId}
                                    onChange={(e) => setForm({ ...form, rbacRoleId: e.target.value })}
                                >
                                    <option value="">Select RBAC role</option>
                                    {activeRbacRoles.map((role) => (
                                        <option key={role.id} value={role.id}>
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                        ) : null}
                    </div>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
