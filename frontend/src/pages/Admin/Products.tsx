import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { useRowSelection } from '../../hooks/useRowSelection';
import { AdminDataTable, AdminPageHeader, BulkActionsBar } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, promptReason, showAlert } from '../../utils/alerts';

const STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'REJECTED', 'OUT_OF_STOCK', 'ARCHIVED'];
type Mode = 'create' | 'edit' | 'view';

const emptyForm = {
    name: '',
    slug: '',
    description: '',
    shortDescription: '',
    categoryId: '',
    sellerId: '',
    brand: '',
    sku: '',
    price: 0,
    compareAtPrice: '',
    stockQuantity: 0,
    status: 'ACTIVE',
    tags: '',
};

export default function AdminProducts() {
    const dispatch = useDispatch();
    const [items, setItems] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [sellers, setSellers] = useState<any[]>([]);
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

    const ids = useMemo(() => items.map((item) => item.id), [items]);
    const selection = useRowSelection(ids);

    const load = async (page = 1, size = pageSize, filters?: { search?: string; status?: string }) => {
        const nextSearch = filters?.search ?? search;
        const nextStatus = filters?.status ?? statusFilter;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listProducts({
                page,
                limit: size,
                search: nextSearch || undefined,
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
        setStatusFilter('');
        load(1, pageSize, { search: '', status: '' });
    };

    const loadLookups = async () => {
        const [cats, sellersData] = await Promise.all([
            adminApi.listCategories({ page: 1, limit: 100 }),
            adminApi.listSellers({ page: 1, limit: 100 }),
        ]);
        setCategories(cats.items);
        setSellers(sellersData.items);
    };

    useEffect(() => {
        dispatch(setPageTitle('Products'));
        load();
        loadLookups().catch((err) => setError(getErrorMessage(err)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm({
            ...emptyForm,
            categoryId: categories[0]?.id ?? '',
            sellerId: sellers[0]?.id ?? '',
        });
        setMode('create');
    };

    const fillForm = (product: any) => {
        setEditingId(product.id);
        setForm({
            name: product.name,
            slug: product.slug,
            description: product.description,
            shortDescription: product.shortDescription ?? '',
            categoryId: product.categoryId,
            sellerId: product.sellerId,
            brand: product.brand ?? '',
            sku: product.sku ?? '',
            price: product.price,
            compareAtPrice: product.compareAtPrice ?? '',
            stockQuantity: product.stockQuantity,
            status: product.status,
            tags: (product.tags ?? []).join(', '),
        });
    };

    const buildBody = () => ({
        name: form.name,
        slug: form.slug || undefined,
        description: form.description,
        shortDescription: form.shortDescription || undefined,
        categoryId: form.categoryId,
        brand: form.brand || undefined,
        sku: form.sku || undefined,
        price: Number(form.price),
        compareAtPrice: form.compareAtPrice === '' ? undefined : Number(form.compareAtPrice),
        stockQuantity: Number(form.stockQuantity),
        status: form.status,
        tags: form.tags
            ? form.tags
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean)
            : [],
    });

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const body: Record<string, unknown> = buildBody();
            if (mode === 'create') {
                body.sellerId = form.sellerId;
                await adminApi.createProduct(body);
                showAlert('Product created successfully');
            } else if (editingId) {
                await adminApi.updateProduct(editingId, body);
                showAlert('Product updated successfully');
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

    const approve = async (id: string) => {
        try {
            await adminApi.approveProduct(id);
            showAlert('Product approved successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const reject = async (id: string) => {
        const reason = await promptReason('Rejection reason');
        if (!reason) return;
        try {
            await adminApi.rejectProduct(id, reason);
            showAlert('Product rejected');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const remove = async (id: string) => {
        const ok = await confirmAction('Delete product?', 'The product will be soft-deleted.');
        if (!ok) return;
        try {
            await adminApi.deleteProduct(id);
            showAlert('Product deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDelete = async () => {
        const ok = await confirmAction(`Delete ${selection.selectedIds.length} products?`);
        if (!ok) return;
        try {
            for (const id of selection.selectedIds) await adminApi.deleteProduct(id);
            selection.clear();
            showAlert('Selected products deleted');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkApprove = async () => {
        try {
            let approvedCount = 0;
            for (const id of selection.selectedIds) {
                const product = items.find((item) => item.id === id);
                if (product?.status === 'PENDING_REVIEW') {
                    await adminApi.approveProduct(id);
                    approvedCount += 1;
                }
            }
            selection.clear();
            showAlert(
                approvedCount ? `${approvedCount} product(s) approved` : 'No pending products selected',
                approvedCount ? 'success' : 'warning',
            );
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const readOnly = mode === 'view';

    return (
        <div>
            <AdminPageHeader
                title="Products"
                subtitle="Catalog, pending review, and approvals"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                onClear={clearFilters}
                canClear={Boolean(search || statusFilter)}
                onCreate={openCreate}
                createLabel="Add Product"
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

            <BulkActionsBar
                count={selection.selectedIds.length}
                onClear={selection.clear}
                onBulkDelete={bulkDelete}
                extra={
                    <button type="button" className="btn btn-sm btn-success" onClick={bulkApprove}>
                        Approve pending
                    </button>
                }
            />

            <AdminDataTable
                columns={[
                    {
                        key: 'name',
                        label: 'Product',
                        sortable: true,
                        sortValue: (row) => row.name,
                        render: (row) => (
                            <div>
                                <div className="font-semibold">{row.name}</div>
                                <div className="text-xs text-white-dark">{row.sku || '—'}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'price',
                        label: 'Price',
                        sortable: true,
                        sortValue: (row) => Number(row.price),
                        render: (row) => `₹${row.price}`,
                    },
                    {
                        key: 'stockQuantity',
                        label: 'Stock',
                        sortable: true,
                        sortValue: (row) => Number(row.stockQuantity),
                        render: (row) => row.stockQuantity,
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
                            {
                                label: 'View',
                                onClick: () => {
                                    fillForm(row);
                                    setMode('view');
                                },
                            },
                            {
                                label: 'Edit',
                                onClick: () => {
                                    fillForm(row);
                                    setMode('edit');
                                },
                            },
                            {
                                label: 'Approve',
                                onClick: () => approve(row.id),
                                hidden: row.status !== 'PENDING_REVIEW',
                            },
                            {
                                label: 'Reject',
                                onClick: () => reject(row.id),
                                hidden: row.status !== 'PENDING_REVIEW',
                            },
                            { label: 'Delete', onClick: () => remove(row.id), danger: true },
                        ]}
                    />
                )}
            />

            <AdminFormModal
                open={mode !== null}
                title={mode === 'create' ? 'Create Product' : mode === 'edit' ? 'Edit Product' : 'View Product'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                readOnly={readOnly}
                busy={busy}
                size="xl"
            >
                <FormSection title="Product details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Name" required>
                            <input className="form-input" required disabled={readOnly} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </FormField>
                        <FormField label="Slug">
                            <input className="form-input" disabled={readOnly} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                        </FormField>
                        {mode === 'create' ? (
                            <FormField label="Seller" required>
                                <select className="form-select" required disabled={readOnly} value={form.sellerId} onChange={(e) => setForm({ ...form, sellerId: e.target.value })}>
                                    <option value="">Select seller</option>
                                    {sellers.map((seller) => (
                                        <option key={seller.id} value={seller.id}>
                                            {seller.businessName}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                        ) : null}
                        <FormField label="Category" required>
                            <select className="form-select" required disabled={readOnly} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                                <option value="">Select category</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Price" required>
                            <input
                                className="form-input"
                                type="number"
                                step="0.01"
                                required
                                disabled={readOnly}
                                value={form.price}
                                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                            />
                        </FormField>
                        <FormField label="Compare at price">
                            <input
                                className="form-input"
                                type="number"
                                step="0.01"
                                disabled={readOnly}
                                value={form.compareAtPrice}
                                onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Stock">
                            <input
                                className="form-input"
                                type="number"
                                disabled={readOnly}
                                value={form.stockQuantity}
                                onChange={(e) => setForm({ ...form, stockQuantity: Number(e.target.value) })}
                            />
                        </FormField>
                        <FormField label="Status" required>
                            <select className="form-select" disabled={readOnly} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                {STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Brand">
                            <input className="form-input" disabled={readOnly} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                        </FormField>
                        <FormField label="SKU">
                            <input className="form-input" disabled={readOnly} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                        </FormField>
                        <FormField label="Tags" hint="Comma separated">
                            <input className="form-input" disabled={readOnly} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                        </FormField>
                        <FormField label="Short description" className="md:col-span-2">
                            <input
                                className="form-input"
                                disabled={readOnly}
                                value={form.shortDescription}
                                onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Description" required className="md:col-span-2">
                            <textarea
                                className="form-textarea min-h-[120px]"
                                required
                                disabled={readOnly}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </FormField>
                    </div>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
