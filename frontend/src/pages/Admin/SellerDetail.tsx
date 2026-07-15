import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { AdminDataTable } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, promptReason, showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';
import IconPlus from '../../components/Icon/IconPlus';

const STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'REJECTED', 'OUT_OF_STOCK', 'ARCHIVED'];
type Mode = 'create' | 'edit' | 'view';

const emptyForm = {
    name: '',
    slug: '',
    description: '',
    shortDescription: '',
    categoryId: '',
    brand: '',
    sku: '',
    price: 0,
    compareAtPrice: '',
    stockQuantity: 0,
    status: 'ACTIVE',
    tags: '',
};

export default function SellerDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [seller, setSeller] = useState<any | null>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1, limit: 10 });
    const [pageSize, setPageSize] = useState(10);
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [productsLoading, setProductsLoading] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<Mode | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [busy, setBusy] = useState(false);

    const loadSeller = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const data = (await adminApi.getSeller(id)) as any;
            setSeller(data);
            dispatch(setPageTitle(data.businessName || 'Seller Detail'));
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadProducts = async (
        page = 1,
        size = pageSize,
        filters?: { search?: string; status?: string },
    ) => {
        if (!id) return;
        const nextSearch = filters?.search ?? search;
        const nextStatus = filters?.status ?? statusFilter;
        setProductsLoading(true);
        try {
            const data = await adminApi.listProducts({
                sellerId: id,
                page,
                limit: size,
                search: nextSearch || undefined,
                status: nextStatus || undefined,
            });
            setProducts(data.items ?? []);
            setMeta(data.meta);
        } catch (err) {
            showAlert(getErrorMessage(err, 'Failed to load products'), 'error');
        } finally {
            setProductsLoading(false);
        }
    };

    const loadCategories = async () => {
        const data = await adminApi.listCategories({ page: 1, limit: 100 });
        setCategories(data.items ?? []);
    };

    useEffect(() => {
        loadSeller();
        loadProducts(1, pageSize);
        loadCategories().catch((err) => showAlert(getErrorMessage(err), 'error'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const openCreate = () => {
        setEditingId(null);
        setForm({
            ...emptyForm,
            categoryId: categories[0]?.id ?? '',
            status: 'ACTIVE',
        });
        setMode('create');
    };

    const fillForm = (product: any) => {
        setEditingId(product.id);
        setForm({
            name: product.name ?? '',
            slug: product.slug ?? '',
            description: product.description ?? '',
            shortDescription: product.shortDescription ?? '',
            categoryId: product.categoryId ?? '',
            brand: product.brand ?? '',
            sku: product.sku ?? '',
            price: Number(product.price) || 0,
            compareAtPrice: product.compareAtPrice ?? '',
            stockQuantity: Number(product.stockQuantity) || 0,
            status: product.status ?? 'ACTIVE',
            tags: (product.tags ?? []).join(', '),
        });
    };

    const openEdit = (product: any) => {
        fillForm(product);
        setMode('edit');
    };

    const openView = (product: any) => {
        fillForm(product);
        setMode('view');
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
        if (!id) return;
        setBusy(true);
        try {
            const body: Record<string, unknown> = buildBody();
            if (mode === 'create') {
                body.sellerId = id;
                await adminApi.createProduct(body);
                showAlert('Product created successfully');
            } else if (editingId) {
                await adminApi.updateProduct(editingId, body);
                showAlert('Product updated successfully');
            }
            setMode(null);
            await loadProducts(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const approveProduct = async (productId: string) => {
        try {
            await adminApi.approveProduct(productId);
            showAlert('Product approved');
            await loadProducts(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const rejectProduct = async (productId: string) => {
        const reason = await promptReason('Rejection reason');
        if (!reason) return;
        try {
            await adminApi.rejectProduct(productId, reason);
            showAlert('Product rejected');
            await loadProducts(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const deleteProduct = async (productId: string) => {
        const ok = await confirmAction('Delete product?');
        if (!ok) return;
        try {
            await adminApi.deleteProduct(productId);
            showAlert('Product deleted');
            await loadProducts(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const infoCards = useMemo(() => {
        if (!seller) return [];
        return [
            { label: 'Owner', value: seller.fullName || '—' },
            { label: 'Email', value: seller.email || '—' },
            { label: 'Mobile', value: seller.mobile || '—' },
            { label: 'Business type', value: seller.businessType || '—' },
            { label: 'Status', value: seller.status },
        ];
    }, [seller]);

    const readOnly = mode === 'view';

    if (loading) {
        return <div className="panel">Loading seller...</div>;
    }

    if (!seller) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'Seller not found'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/admin/sellers')}>
                    Back to sellers
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-start gap-3">
                    <Link to="/admin/sellers" className="btn btn-outline-primary p-2 mt-0.5" aria-label="Back">
                        <IconArrowLeft className="w-4.5 h-4.5" />
                    </Link>
                    <div>
                        <h2 className="text-xl font-semibold dark:text-white-light">{seller.businessName}</h2>
                        <p className="text-white-dark text-sm mt-1">Seller detail and uploaded products</p>
                    </div>
                </div>
                <StatusBadge status={seller.status} />
            </div>

            <div className="panel mb-5">
                <h5 className="font-semibold text-lg mb-4">Seller information</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {infoCards.map((card) => (
                        <div key={card.label} className="rounded border border-[#ebedf2] dark:border-[#191e3a] p-4">
                            <div className="text-xs uppercase tracking-wide text-white-dark mb-1">{card.label}</div>
                            <div className="font-semibold break-all">
                                {card.label === 'Status' ? <StatusBadge status={String(card.value)} /> : card.value}
                            </div>
                        </div>
                    ))}
                </div>
                {seller.description ? (
                    <div className="mt-4">
                        <div className="text-xs uppercase tracking-wide text-white-dark mb-1">Description</div>
                        <p className="text-sm">{seller.description}</p>
                    </div>
                ) : null}
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h5 className="font-semibold text-lg">Products</h5>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        className="form-input w-48"
                        placeholder="Search products..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') loadProducts(1, pageSize);
                        }}
                    />
                    <select className="form-select w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">All statuses</option>
                        {STATUSES.map((status) => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </select>
                    <button type="button" className="btn btn-primary" onClick={() => loadProducts(1, pageSize)}>
                        Filter
                    </button>
                    <button
                        type="button"
                        className="btn btn-outline-dark"
                        onClick={() => {
                            setSearch('');
                            setStatusFilter('');
                            loadProducts(1, pageSize, { search: '', status: '' });
                        }}
                    >
                        Clear
                    </button>
                    <button type="button" className="btn btn-primary" onClick={openCreate}>
                        <IconPlus className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" />
                        Add Product
                    </button>
                </div>
            </div>

            <AdminDataTable
                selectable={false}
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
                rows={products}
                loading={productsLoading}
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                pageSize={pageSize}
                onPageChange={(page) => loadProducts(page, pageSize)}
                onPageSizeChange={(size) => {
                    setPageSize(size);
                    loadProducts(1, size);
                }}
                actions={(row) => (
                    <RowActionsMenu
                        actions={[
                            { label: 'View', onClick: () => openView(row) },
                            { label: 'Edit', onClick: () => openEdit(row) },
                            {
                                label: 'Approve',
                                onClick: () => approveProduct(row.id),
                                hidden: row.status !== 'PENDING_REVIEW',
                            },
                            {
                                label: 'Reject',
                                onClick: () => rejectProduct(row.id),
                                danger: true,
                                hidden: row.status !== 'PENDING_REVIEW',
                            },
                            { label: 'Delete', onClick: () => deleteProduct(row.id), danger: true },
                        ]}
                    />
                )}
                emptyText="No products uploaded by this seller"
            />

            <AdminFormModal
                open={mode !== null}
                title={mode === 'create' ? 'Add Product' : mode === 'edit' ? 'Edit Product' : 'View Product'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                readOnly={readOnly}
                busy={busy}
                size="xl"
            >
                <FormSection title="Product details" className="md:col-span-2" description={`Listed under ${seller.businessName}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Seller" hint="Locked to this seller profile">
                            <input className="form-input" disabled value={seller.businessName} />
                        </FormField>
                        <FormField label="Category" required>
                            <select
                                className="form-select"
                                required
                                disabled={readOnly}
                                value={form.categoryId}
                                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                            >
                                <option value="">Select category</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Name" required>
                            <input
                                className="form-input"
                                required
                                disabled={readOnly}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Slug">
                            <input
                                className="form-input"
                                disabled={readOnly}
                                value={form.slug}
                                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                            />
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
                        <FormField label="Brand">
                            <input
                                className="form-input"
                                disabled={readOnly}
                                value={form.brand}
                                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                            />
                        </FormField>
                        <FormField label="SKU">
                            <input
                                className="form-input"
                                disabled={readOnly}
                                value={form.sku}
                                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Tags" hint="Comma separated" className="md:col-span-2">
                            <input
                                className="form-input"
                                disabled={readOnly}
                                value={form.tags}
                                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                            />
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
