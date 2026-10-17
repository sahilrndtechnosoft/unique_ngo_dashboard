import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { AdminColumn, AdminDataTable, AdminPageHeader } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';

type Mode = 'create' | 'edit';

export interface PartnerStoreRow {
    id: string;
    name: string;
    slug: string;
    description?: string;
    category: string;
    logoUrl?: string;
    websiteUrl?: string;
    adapterType: string;
    isActive: boolean;
    createdAt: string;
}

const emptyForm = {
    name: '',
    slug: '',
    description: '',
    category: 'FOOD_AND_DINING',
    logoUrl: '',
    websiteUrl: '',
    adapterType: 'MOCK',
    isActive: true,
};

const CATEGORIES = [
    { value: 'FOOD_AND_DINING', label: 'Food & Dining' },
    { value: 'HEALTH_AND_WELLNESS', label: 'Health & Wellness' },
    { value: 'RETAIL_SHOPPING', label: 'Retail & Shopping' },
    { value: 'ENTERTAINMENT', label: 'Entertainment' },
    { value: 'TRAVEL', label: 'Travel & Mobility' },
    { value: 'OTHER', label: 'Other' },
];

const ADAPTER_TYPES = [
    { value: 'MOCK', label: 'Mock Voucher Adapter' },
    { value: 'PIZZA_HUT', label: 'Pizza Hut Partner Adapter' },
];

export default function AdminPartners() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [items, setItems] = useState<PartnerStoreRow[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<Mode | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);

    const load = async (page = 1, size = pageSize, currentSearch = search) => {
        setLoading(true);
        setError('');
        try {
            const res = await adminApi.listPartners({
                page,
                limit: size,
                search: currentSearch || undefined,
            });
            setItems(res.items);
            setMeta(res.meta);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        dispatch(setPageTitle('Partner Stores'));
        load(1, pageSize);
    }, [dispatch]);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setMode('create');
    };

    const openEdit = (partner: PartnerStoreRow) => {
        setEditingId(partner.id);
        setForm({
            name: partner.name ?? '',
            slug: partner.slug ?? '',
            description: partner.description ?? '',
            category: partner.category ?? 'FOOD_AND_DINING',
            logoUrl: partner.logoUrl ?? '',
            websiteUrl: partner.websiteUrl ?? '',
            adapterType: partner.adapterType ?? 'MOCK',
            isActive: partner.isActive ?? true,
        });
        setMode('edit');
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            if (mode === 'create') {
                await adminApi.createPartner(form);
                showAlert('Partner store created successfully');
            } else if (mode === 'edit' && editingId) {
                await adminApi.updatePartner(editingId, form);
                showAlert('Partner store updated successfully');
            }
            setMode(null);
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const toggleActive = async (partner: PartnerStoreRow) => {
        try {
            await adminApi.updatePartner(partner.id, { isActive: !partner.isActive });
            showAlert(partner.isActive ? 'Partner deactivated' : 'Partner activated');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const remove = async (id: string) => {
        const ok = await confirmAction('Delete this partner store?');
        if (!ok) return;
        try {
            await adminApi.deletePartner(id);
            showAlert('Partner store deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const columns: AdminColumn<PartnerStoreRow>[] = [
        {
            key: 'name',
            label: 'Partner Store',
            render: (row) => (
                <div className="flex items-center gap-3">
                    {row.logoUrl ? (
                        <img src={row.logoUrl} alt={row.name} className="h-9 w-9 rounded object-cover shadow-sm" />
                    ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded bg-primary-light font-bold text-primary">
                            {row.name.charAt(0)}
                        </div>
                    )}
                    <div>
                        <Link
                            to={`/admin/partners/${row.id}`}
                            className="font-semibold text-gray-900 dark:text-white-dark hover:text-primary transition-colors"
                        >
                            {row.name}
                        </Link>
                        <div className="text-xs text-white-dark">{row.slug}</div>
                    </div>
                </div>
            ),
        },
        {
            key: 'category',
            label: 'Category',
            render: (row) => <span className="badge badge-outline-primary">{row.category?.replace(/_/g, ' ')}</span>,
        },
        {
            key: 'adapterType',
            label: 'Adapter',
            render: (row) => (
                <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-300">
                    {row.adapterType}
                </span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
        },
        {
            key: 'createdAt',
            label: 'Onboarded',
            render: (row) => new Date(row.createdAt).toLocaleDateString(),
        },
    ];

    return (
        <div>
            <AdminPageHeader
                title="Partner Stores"
                subtitle="Onboard and manage merchant partner integrations for points redemption"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize, search)}
                onClear={() => {
                    setSearch('');
                    load(1, pageSize, '');
                }}
                canClear={Boolean(search)}
                onCreate={openCreate}
                createLabel="Add Partner"
            />

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

            <AdminDataTable<PartnerStoreRow>
                columns={columns}
                rows={items}
                loading={loading}
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                pageSize={pageSize}
                onPageChange={(p) => load(p, pageSize)}
                onPageSizeChange={(s) => {
                    setPageSize(s);
                    load(1, s);
                }}
                actions={(row) => (
                    <RowActionsMenu
                        actions={[
                            { label: 'View', onClick: () => navigate(`/admin/partners/${row.id}`) },
                            { label: 'Edit', onClick: () => openEdit(row) },
                            { label: row.isActive ? 'Deactivate' : 'Activate', onClick: () => toggleActive(row) },
                            { label: 'Delete', onClick: () => remove(row.id), danger: true },
                        ]}
                    />
                )}
            />

            <AdminFormModal
                open={mode !== null}
                title={mode === 'create' ? 'Add Partner Store' : 'Edit Partner Store'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                busy={busy}
                size="lg"
            >
                <FormSection title="Partner Information" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Partner Name" required>
                            <input
                                className="form-input"
                                required
                                value={form.name}
                                onChange={(e) => {
                                    const name = e.target.value;
                                    setForm({
                                        ...form,
                                        name,
                                        slug: mode === 'create' ? name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') : form.slug,
                                    });
                                }}
                            />
                        </FormField>
                        <FormField label="Slug" required hint="Unique alphanumeric URL identifier">
                            <input
                                className="form-input"
                                required
                                value={form.slug}
                                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                            />
                        </FormField>
                        <FormField label="Category" required>
                            <select
                                className="form-select"
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c.value} value={c.value}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Integration Adapter" required hint="Backend adapter used for live voucher issuance">
                            <select
                                className="form-select"
                                value={form.adapterType}
                                onChange={(e) => setForm({ ...form, adapterType: e.target.value })}
                            >
                                {ADAPTER_TYPES.map((a) => (
                                    <option key={a.value} value={a.value}>
                                        {a.label}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Logo URL">
                            <input
                                className="form-input"
                                placeholder="https://..."
                                value={form.logoUrl}
                                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Website URL">
                            <input
                                className="form-input"
                                placeholder="https://..."
                                value={form.websiteUrl}
                                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Description" className="md:col-span-2">
                            <textarea
                                className="form-textarea"
                                rows={2}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Active Status">
                            <label className="flex items-center gap-2 cursor-pointer h-[38px]">
                                <input
                                    type="checkbox"
                                    className="form-checkbox"
                                    checked={form.isActive}
                                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                />
                                Store is active for redemptions
                            </label>
                        </FormField>
                    </div>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
