import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage, mediaUrl } from '../../services/api';
import { useRowSelection } from '../../hooks/useRowSelection';
import { AdminDataTable, AdminPageHeader, BulkActionsBar } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';

const STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'UNDER_REVIEW'];
type Mode = 'create' | 'edit';

const emptyForm = {
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    businessName: '',
    businessType: '',
    description: '',
    status: 'ACTIVE',
    rejectionReason: '',
    profilePicture: '' as string | null,
};

export default function AdminSellers() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
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

    const load = async (
        page = 1,
        size = pageSize,
        filters?: { search?: string; status?: string },
    ) => {
        const nextSearch = filters?.search ?? search;
        const nextStatus = filters?.status ?? statusFilter;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listSellers({
                page,
                limit: size,
                search: nextSearch || undefined,
                status: nextStatus || undefined,
            });
            setItems(data.items);
            setMeta(data.meta);
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('');
        load(1, pageSize, { search: '', status: '' });
    };

    useEffect(() => {
        dispatch(setPageTitle('Sellers'));
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setPendingImage(null);
        setMode('create');
    };

    const openEdit = (seller: any) => {
        setEditingId(seller.id);
        setForm({
            fullName: seller.fullName ?? '',
            email: seller.email ?? '',
            mobile: seller.mobile ?? '',
            password: '',
            businessName: seller.businessName ?? '',
            businessType: seller.businessType ?? '',
            description: seller.description ?? '',
            status: seller.status,
            rejectionReason: seller.rejectionReason ?? '',
            profilePicture: seller.profilePicture ?? null,
        });
        setPendingImage(null);
        setMode('edit');
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            let id = editingId;
            if (mode === 'create') {
                const created = (await adminApi.createSeller({
                    fullName: form.fullName,
                    email: form.email,
                    mobile: form.mobile,
                    password: form.password,
                    businessName: form.businessName,
                    businessType: form.businessType || undefined,
                    description: form.description || undefined,
                    status: form.status,
                })) as any;
                id = created?.id;
                showAlert('Seller created successfully');
            } else if (editingId) {
                const body: Record<string, unknown> = {
                    fullName: form.fullName,
                    email: form.email,
                    mobile: form.mobile,
                    businessName: form.businessName,
                    businessType: form.businessType || undefined,
                    description: form.description || undefined,
                    status: form.status,
                    rejectionReason: form.rejectionReason || undefined,
                };
                if (form.password) body.password = form.password;
                await adminApi.updateSeller(editingId, body);
                showAlert('Seller updated successfully');
            }
            if (id && pendingImage) {
                await adminApi.uploadSellerImage(id, pendingImage);
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
        const ok = await confirmAction('Delete seller?', 'The seller profile will be soft-deleted.');
        if (!ok) return;
        try {
            await adminApi.deleteSeller(id);
            showAlert('Seller deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDelete = async () => {
        const ok = await confirmAction(`Delete ${selection.selectedIds.length} sellers?`);
        if (!ok) return;
        try {
            for (const id of selection.selectedIds) await adminApi.deleteSeller(id);
            selection.clear();
            showAlert('Selected sellers deleted');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Sellers"
                subtitle="Manage seller accounts — open a seller to review their products"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                onClear={clearFilters}
                canClear={Boolean(search || statusFilter)}
                onCreate={openCreate}
                createLabel="Add Seller"
                filters={
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
                        key: 'businessName',
                        label: 'Business',
                        sortable: true,
                        sortValue: (row) => row.businessName,
                        render: (row) => (
                            <div>
                                <div className="font-semibold">{row.businessName}</div>
                                <div className="text-xs text-white-dark">{row.businessType || '—'}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'fullName',
                        label: 'Owner',
                        sortable: true,
                        sortValue: (row) => row.fullName,
                        render: (row) => row.fullName,
                    },
                    {
                        key: 'email',
                        label: 'Contact',
                        sortable: true,
                        sortValue: (row) => row.email,
                        render: (row) => (
                            <div>
                                <div>{row.email}</div>
                                <div className="text-xs text-white-dark">{row.mobile}</div>
                            </div>
                        ),
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
                            { label: 'View', onClick: () => navigate(`/admin/sellers/${row.id}`) },
                            { label: 'Edit', onClick: () => openEdit(row) },
                            { label: 'Delete', onClick: () => remove(row.id), danger: true },
                        ]}
                    />
                )}
            />

            <AdminFormModal
                open={mode !== null}
                title={mode === 'create' ? 'Create Seller' : 'Edit Seller'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                busy={busy}
                size="xl"
            >
                <FormSection title="Account details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Profile Picture" className="md:col-span-2">
                            <div className="flex items-center gap-4">
                                {form.profilePicture ? (
                                    <img src={mediaUrl(form.profilePicture)} alt="" className="h-16 w-16 rounded-full object-cover" />
                                ) : null}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="form-input"
                                    onChange={(e) => setPendingImage(e.target.files?.[0] ?? null)}
                                />
                            </div>
                        </FormField>
                        <FormField label="Full Name" required>
                            <input className="form-input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                        </FormField>
                        <FormField label="Email" required>
                            <input className="form-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        </FormField>
                        <FormField label="Mobile" required>
                            <input className="form-input" required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                        </FormField>
                        <FormField label="Password" required={mode === 'create'} hint={mode === 'edit' ? 'Optional on edit' : undefined}>
                            <input
                                className="form-input"
                                type="password"
                                required={mode === 'create'}
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                            />
                        </FormField>
                    </div>
                </FormSection>
                <FormSection title="Business details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Business Name" required>
                            <input className="form-input" required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
                        </FormField>
                        <FormField label="Business Type">
                            <input className="form-input" value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} />
                        </FormField>
                        <FormField label="Status" required>
                            <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                {STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Notes / Reason">
                            <input className="form-input" value={form.rejectionReason} onChange={(e) => setForm({ ...form, rejectionReason: e.target.value })} />
                        </FormField>
                        <FormField label="Description" className="md:col-span-2">
                            <textarea className="form-textarea min-h-[100px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </FormField>
                    </div>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
