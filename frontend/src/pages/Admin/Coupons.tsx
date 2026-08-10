import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { useRowSelection } from '../../hooks/useRowSelection';
import { AdminDataTable, AdminPageHeader, BulkActionsBar } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';

type Mode = 'create' | 'edit' | 'view';

const DISCOUNT_TYPES = ['PERCENTAGE', 'FLAT'];

const emptyForm = {
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: '10',
    minOrderValue: '0',
    maxDiscount: '',
    usageLimit: '',
    perUserLimit: '1',
    applicableTo: 'ALL',
    startsAt: '',
    expiresAt: '',
    isActive: true,
};

export default function AdminCoupons() {
    const dispatch = useDispatch();
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
    const [usages, setUsages] = useState<any[]>([]);

    const ids = useMemo(() => items.map((item) => item.id), [items]);
    const selection = useRowSelection(ids);

    const load = async (page = 1, size = pageSize, filters?: { search?: string; status?: string }) => {
        const nextSearch = filters?.search ?? search;
        const nextStatus = filters?.status ?? statusFilter;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listCoupons({
                page,
                limit: size,
                search: nextSearch || undefined,
                isActive: nextStatus === '' ? undefined : nextStatus === 'ACTIVE',
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
        setStatusFilter('');
        load(1, pageSize, { search: '', status: '' });
    };

    useEffect(() => {
        dispatch(setPageTitle('Coupons'));
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setUsages([]);
        setMode('create');
    };

    const fillForm = (coupon: any) => {
        setEditingId(coupon.id);
        setForm({
            code: coupon.code,
            description: coupon.description ?? '',
            discountType: coupon.discountType,
            discountValue: String(coupon.discountValue),
            minOrderValue: String(coupon.minOrderValue),
            maxDiscount: coupon.maxDiscount !== null ? String(coupon.maxDiscount) : '',
            usageLimit: coupon.usageLimit !== null ? String(coupon.usageLimit) : '',
            perUserLimit: String(coupon.perUserLimit),
            applicableTo: coupon.applicableTo,
            startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 10) : '',
            expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : '',
            isActive: coupon.isActive,
        });
    };

    const openView = async (coupon: any) => {
        fillForm(coupon);
        setMode('view');
        try {
            const data = await adminApi.getCouponUsages(coupon.id);
            setUsages(data);
        } catch {
            setUsages([]);
        }
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const body = {
                code: form.code || undefined,
                description: form.description || undefined,
                discountType: form.discountType,
                discountValue: Number(form.discountValue) || 0,
                minOrderValue: Number(form.minOrderValue) || 0,
                maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
                usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
                perUserLimit: Number(form.perUserLimit) || 1,
                applicableTo: form.applicableTo || undefined,
                startsAt: form.startsAt || undefined,
                expiresAt: form.expiresAt || undefined,
            };
            if (mode === 'create') {
                await adminApi.createCoupon(body);
                showAlert('Coupon created successfully');
            } else if (editingId) {
                await adminApi.updateCoupon(editingId, { ...body, isActive: form.isActive });
                showAlert('Coupon updated successfully');
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

    const toggleActive = async (coupon: any) => {
        try {
            await adminApi.updateCoupon(coupon.id, { isActive: !coupon.isActive });
            showAlert(coupon.isActive ? 'Coupon deactivated' : 'Coupon activated');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const remove = async (id: string) => {
        const ok = await confirmAction('Delete coupon?');
        if (!ok) return;
        try {
            await adminApi.deleteCoupon(id);
            showAlert('Coupon deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDelete = async () => {
        const ok = await confirmAction(`Delete ${selection.selectedIds.length} coupon(s)?`);
        if (!ok) return;
        try {
            for (const id of selection.selectedIds) await adminApi.deleteCoupon(id);
            selection.clear();
            showAlert('Selected coupons deleted');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const readOnly = mode === 'view';

    return (
        <div>
            <AdminPageHeader
                title="Coupons"
                subtitle="Discount coupons users can redeem at checkout"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                onClear={clearFilters}
                canClear={Boolean(search || statusFilter)}
                onCreate={openCreate}
                createLabel="Add Coupon"
                filters={
                    <select
                        className="form-select w-full sm:w-auto min-w-[160px] shrink-0"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            load(1, pageSize, { status: e.target.value });
                        }}
                    >
                        <option value="">All coupons</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                }
            />

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

            <BulkActionsBar count={selection.selectedIds.length} onClear={selection.clear} onBulkDelete={bulkDelete} />

            <AdminDataTable
                columns={[
                    {
                        key: 'code',
                        label: 'Code',
                        sortable: true,
                        sortValue: (row) => row.code,
                        render: (row) => (
                            <div>
                                <div className="font-semibold">{row.code}</div>
                                <div className="text-xs text-white-dark">{row.description || '—'}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'discount',
                        label: 'Discount',
                        render: (row) => (row.discountType === 'FLAT' ? `₹${row.discountValue}` : `${row.discountValue}%`),
                    },
                    {
                        key: 'usage',
                        label: 'Usage',
                        render: (row) => `${row.usedCount} / ${row.usageLimit ?? '∞'}`,
                    },
                    {
                        key: 'expiresAt',
                        label: 'Expires',
                        sortable: true,
                        sortValue: (row) => row.expiresAt ?? '',
                        render: (row) => (row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : 'Never'),
                    },
                    {
                        key: 'isActive',
                        label: 'Status',
                        render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
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
                            {
                                label: 'Edit',
                                onClick: () => {
                                    fillForm(row);
                                    setMode('edit');
                                },
                            },
                            { label: row.isActive ? 'Deactivate' : 'Activate', onClick: () => toggleActive(row) },
                            { label: 'Delete', onClick: () => remove(row.id), danger: true },
                        ]}
                    />
                )}
            />

            <AdminFormModal
                open={mode !== null}
                title={mode === 'create' ? 'Add Coupon' : mode === 'edit' ? 'Edit Coupon' : 'View Coupon'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                readOnly={readOnly}
                busy={busy}
                size="xl"
            >
                <FormSection title="Coupon details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Code" required hint={mode !== 'create' ? 'Code cannot be changed after creation' : undefined}>
                            <input
                                className="form-input"
                                required
                                disabled={readOnly || mode === 'edit'}
                                value={form.code}
                                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                            />
                        </FormField>
                        <FormField label="Applicable To">
                            <input className="form-input" disabled={readOnly} value={form.applicableTo} onChange={(e) => setForm({ ...form, applicableTo: e.target.value })} />
                        </FormField>
                        <FormField label="Description" className="md:col-span-2">
                            <textarea className="form-textarea" disabled={readOnly} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </FormField>
                        <FormField label="Discount Type" required>
                            <select className="form-select" required disabled={readOnly} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
                                {DISCOUNT_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label={form.discountType === 'FLAT' ? 'Discount Amount (₹)' : 'Discount (%)'} required>
                            <input
                                className="form-input"
                                type="number"
                                min={0}
                                required
                                disabled={readOnly}
                                value={form.discountValue}
                                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Min Order Value (₹)">
                            <input
                                className="form-input"
                                type="number"
                                min={0}
                                disabled={readOnly}
                                value={form.minOrderValue}
                                onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Max Discount Cap (₹)" hint="Useful for percentage coupons">
                            <input
                                className="form-input"
                                type="number"
                                min={0}
                                disabled={readOnly}
                                value={form.maxDiscount}
                                onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Total Usage Limit" hint="Leave blank for unlimited">
                            <input
                                className="form-input"
                                type="number"
                                min={1}
                                disabled={readOnly}
                                value={form.usageLimit}
                                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Per-User Limit" required>
                            <input
                                className="form-input"
                                type="number"
                                min={1}
                                required
                                disabled={readOnly}
                                value={form.perUserLimit}
                                onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Starts At">
                            <input className="form-input" type="date" disabled={readOnly} value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                        </FormField>
                        <FormField label="Expires At">
                            <input className="form-input" type="date" disabled={readOnly} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
                        </FormField>
                        {mode !== 'create' ? (
                            <FormField label="Active">
                                <label className="flex items-center gap-2 cursor-pointer h-[38px]">
                                    <input type="checkbox" className="form-checkbox" disabled={readOnly} checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                                    Coupon is active
                                </label>
                            </FormField>
                        ) : null}
                    </div>
                </FormSection>

                {mode === 'view' ? (
                    <FormSection title={`Usage History (${usages.length})`} className="md:col-span-2">
                        {usages.length === 0 ? (
                            <p className="text-sm text-white-dark italic">Not used by any customer yet</p>
                        ) : (
                            <div className="space-y-2">
                                {usages.map((usage) => (
                                    <div key={usage.id} className="flex items-center justify-between text-sm border-b border-[#ebedf2] dark:border-[#191e3a] pb-2">
                                        <span>{usage.user?.fullName ?? usage.user?.email ?? 'Unknown user'}</span>
                                        <span className="text-white-dark">₹{usage.discount}</span>
                                        <span className="text-white-dark">{new Date(usage.usedAt).toLocaleDateString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </FormSection>
                ) : null}
            </AdminFormModal>
        </div>
    );
}
