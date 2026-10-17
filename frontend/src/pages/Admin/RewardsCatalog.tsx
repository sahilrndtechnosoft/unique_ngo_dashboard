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

export interface CatalogItemRow {
    id: string;
    title: string;
    description?: string;
    category: string;
    partnerStoreId?: string;
    partnerStore?: { id: string; name: string } | null;
    pointsCost: number;
    monetaryValue: number;
    itemType: string;
    stock?: number | null;
    validityDays: number;
    minUserTier: string;
    imageUrl?: string;
    termsAndConditions?: string;
    isActive: boolean;
}

const emptyForm = {
    title: '',
    description: '',
    category: 'FOOD',
    partnerStoreId: '',
    pointsCost: '200',
    monetaryValue: '200',
    itemType: 'PARTNER_VOUCHER',
    stock: '100',
    validityDays: '30',
    minUserTier: 'BRONZE',
    imageUrl: '',
    termsAndConditions: '',
    isActive: true,
};

const TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

export default function AdminRewardsCatalog() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [items, setItems] = useState<CatalogItemRow[]>([]);
    const [partners, setPartners] = useState<any[]>([]);
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
            const [catalogRes, partnersRes] = await Promise.all([
                adminApi.listCatalogItems({
                    page,
                    limit: size,
                    search: currentSearch || undefined,
                }),
                adminApi.listPartners({ limit: 100 }),
            ]);
            setItems(catalogRes.items);
            setMeta(catalogRes.meta);
            setPartners(partnersRes.items);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        dispatch(setPageTitle('Rewards Catalog'));
        load(1, pageSize);
    }, [dispatch]);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setMode('create');
    };

    const openEdit = (item: CatalogItemRow) => {
        setEditingId(item.id);
        setForm({
            title: item.title ?? '',
            description: item.description ?? '',
            category: item.category ?? 'FOOD',
            partnerStoreId: item.partnerStoreId ?? '',
            pointsCost: String(item.pointsCost ?? 0),
            monetaryValue: String(item.monetaryValue ?? 0),
            itemType: item.itemType ?? 'PARTNER_VOUCHER',
            stock: item.stock !== null && item.stock !== undefined ? String(item.stock) : '',
            validityDays: String(item.validityDays ?? 30),
            minUserTier: item.minUserTier ?? 'BRONZE',
            imageUrl: item.imageUrl ?? '',
            termsAndConditions: item.termsAndConditions ?? '',
            isActive: item.isActive ?? true,
        });
        setMode('edit');
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const payload = {
                title: form.title,
                description: form.description || undefined,
                category: form.category,
                partnerStoreId: form.partnerStoreId || undefined,
                pointsCost: parseInt(form.pointsCost, 10),
                monetaryValue: parseFloat(form.monetaryValue),
                itemType: form.itemType,
                stock: form.stock ? parseInt(form.stock, 10) : undefined,
                validityDays: parseInt(form.validityDays, 10),
                minUserTier: form.minUserTier,
                imageUrl: form.imageUrl || undefined,
                termsAndConditions: form.termsAndConditions || undefined,
                isActive: form.isActive,
            };

            if (mode === 'create') {
                await adminApi.createCatalogItem(payload);
                showAlert('Reward item created successfully');
            } else if (mode === 'edit' && editingId) {
                await adminApi.updateCatalogItem(editingId, payload);
                showAlert('Reward item updated successfully');
            }
            setMode(null);
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: string) => {
        const ok = await confirmAction('Delete this reward catalog item?');
        if (!ok) return;
        try {
            await adminApi.deleteCatalogItem(id);
            showAlert('Item deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const columns: AdminColumn<CatalogItemRow>[] = [
        {
            key: 'item',
            label: 'Reward Item',
            render: (row) => (
                <div className="flex items-center gap-3">
                    {row.imageUrl ? (
                        <img src={row.imageUrl} alt={row.title} className="h-10 w-10 rounded object-cover shadow-sm" />
                    ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-warning-light font-bold text-warning">
                            🎁
                        </div>
                    )}
                    <div>
                        <Link
                            to={`/admin/rewards-catalog/${row.id}`}
                            className="font-semibold text-gray-900 dark:text-white-dark hover:text-primary transition-colors"
                        >
                            {row.title}
                        </Link>
                        <div className="text-xs text-white-dark">
                            {row.partnerStore?.name ? `Partner: ${row.partnerStore.name}` : 'Direct Platform Reward'}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            key: 'cost',
            label: 'Cost & Value',
            render: (row) => (
                <div>
                    <span className="font-bold text-primary">{row.pointsCost} pts</span>
                    <span className="text-xs text-white-dark block">₹{row.monetaryValue}</span>
                </div>
            ),
        },
        {
            key: 'stock',
            label: 'Stock',
            render: (row) => (
                <span className={row.stock === 0 ? 'text-danger font-semibold' : 'text-gray-700 dark:text-gray-300'}>
                    {row.stock !== null && row.stock !== undefined ? `${row.stock} left` : 'Unlimited'}
                </span>
            ),
        },
        {
            key: 'minUserTier',
            label: 'Tier',
            render: (row) => <span className="badge badge-outline-secondary">{row.minUserTier}</span>,
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
        },
    ];

    return (
        <div>
            <AdminPageHeader
                title="Rewards Catalog"
                subtitle="Configure vouchers and rewards that users can redeem with earned points"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize, search)}
                onClear={() => {
                    setSearch('');
                    load(1, pageSize, '');
                }}
                canClear={Boolean(search)}
                onCreate={openCreate}
                createLabel="Add Reward Item"
            />

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

            <AdminDataTable<CatalogItemRow>
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
                            { label: 'View', onClick: () => navigate(`/admin/rewards-catalog/${row.id}`) },
                            { label: 'Edit', onClick: () => openEdit(row) },
                            { label: 'Delete', onClick: () => remove(row.id), danger: true },
                        ]}
                    />
                )}
            />

            <AdminFormModal
                open={mode !== null}
                title={mode === 'create' ? 'Add Reward Catalog Item' : 'Edit Reward Catalog Item'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                busy={busy}
                size="lg"
            >
                <FormSection title="Catalog Item Details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Title" required className="md:col-span-2">
                            <input
                                className="form-input"
                                required
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Partner Store">
                            <select
                                className="form-select"
                                value={form.partnerStoreId}
                                onChange={(e) => setForm({ ...form, partnerStoreId: e.target.value })}
                            >
                                <option value="">No Partner (Internal / Merchandise)</option>
                                {partners.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Category" required>
                            <input
                                className="form-input"
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value.toUpperCase() })}
                            />
                        </FormField>
                        <FormField label="Points Cost" required hint="Points required to redeem">
                            <input
                                className="form-input"
                                type="number"
                                min={1}
                                required
                                value={form.pointsCost}
                                onChange={(e) => setForm({ ...form, pointsCost: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Monetary Value (₹)" required hint="Cash value or bill deduction amount">
                            <input
                                className="form-input"
                                type="number"
                                min={0}
                                step="0.01"
                                required
                                value={form.monetaryValue}
                                onChange={(e) => setForm({ ...form, monetaryValue: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Stock" hint="Leave blank for unlimited quantity">
                            <input
                                className="form-input"
                                type="number"
                                min={0}
                                value={form.stock}
                                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Validity (Days)" required hint="Days voucher remains active after redemption">
                            <input
                                className="form-input"
                                type="number"
                                min={1}
                                required
                                value={form.validityDays}
                                onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Minimum Tier Required">
                            <select
                                className="form-select"
                                value={form.minUserTier}
                                onChange={(e) => setForm({ ...form, minUserTier: e.target.value })}
                            >
                                {TIERS.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Image URL">
                            <input
                                className="form-input"
                                placeholder="https://..."
                                value={form.imageUrl}
                                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
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
                                Item is available for user redemption
                            </label>
                        </FormField>
                    </div>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
