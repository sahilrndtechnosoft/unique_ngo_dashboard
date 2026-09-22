import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { useRowSelection } from '../../hooks/useRowSelection';
import { AdminDataTable, AdminPageHeader } from '../../components/Admin/AdminTable';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { showAlert } from '../../utils/alerts';
import IconX from '../../components/Icon/IconX';

const STATUSES = [
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'RETURNED',
    'REFUNDED',
];

const emptySale = {
    source: 'ADMIN_COUNTER',
    buyerName: '',
    buyerMobile: '',
    buyerEmail: '',
    shippingType: 'PICKUP',
    shippingFee: '0',
    paymentMethod: 'CASH',
    paymentStatus: 'SUCCESS',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    items: [{ productId: '', variantId: '', variants: [] as any[], quantity: 1 }],
};

export default function AdminOrders() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState(() => {
        const status = searchParams.get('status') ?? '';
        return STATUSES.includes(status) ? status : '';
    });
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [saleOpen, setSaleOpen] = useState(false);
    const [saleBusy, setSaleBusy] = useState(false);
    const [catalog, setCatalog] = useState<any[]>([]);
    const [sale, setSale] = useState(emptySale);

    const ids = useMemo(() => items.map((item) => item.id), [items]);
    const selection = useRowSelection(ids);

    const load = async (page = 1, size = pageSize, filters?: { search?: string; status?: string }) => {
        const nextSearch = filters?.search ?? search;
        const nextStatus = filters?.status ?? statusFilter;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listOrders({
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
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('status');
        setSearchParams(nextParams, { replace: true });
        load(1, pageSize, { search: '', status: '' });
    };

    const searchOrders = () => {
        const nextParams = new URLSearchParams(searchParams);
        if (statusFilter) nextParams.set('status', statusFilter);
        else nextParams.delete('status');
        setSearchParams(nextParams, { replace: true });
        load(1, pageSize);
    };

    const openSale = async () => {
        setSale(emptySale);
        setSaleOpen(true);
        try {
            const products = await adminApi.listProducts({ page: 1, limit: 100, status: 'ACTIVE' });
            setCatalog(products.items);
        } catch (err) {
            setError(getErrorMessage(err));
        }
    };

    const chooseSaleProduct = async (index: number, productId: string) => {
        try {
            const variants = productId ? await adminApi.listProductVariants(productId) : [];
            setSale((current) => ({
                ...current,
                items: current.items.map((row, rowIndex) => rowIndex === index
                    ? { ...row, productId, variantId: '', variants }
                    : row),
            }));
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const createSale = async (event: FormEvent) => {
        event.preventDefault();
        if (!sale.items.length || sale.items.some((item) => !item.productId || item.quantity < 1)) {
            showAlert('Add a product and quantity for each sale line', 'error');
            return;
        }
        setSaleBusy(true);
        try {
            const pickup = sale.shippingType === 'PICKUP';
            const result = await adminApi.createAdminSale({
                buyerName: sale.buyerName,
                buyerMobile: sale.buyerMobile,
                buyerEmail: sale.buyerEmail || undefined,
                source: sale.source,
                shippingType: sale.shippingType,
                shippingFee: Number(sale.shippingFee || 0),
                paymentMethod: sale.paymentMethod,
                paymentStatus: sale.paymentStatus,
                items: sale.items.map(({ productId, variantId, quantity }) => ({
                    productId,
                    ...(variantId ? { variantId } : {}),
                    quantity: Number(quantity),
                })),
                ...(!pickup ? {
                    shippingAddress: {
                        fullName: sale.buyerName,
                        mobile: sale.buyerMobile,
                        addressLine1: sale.addressLine1,
                        addressLine2: sale.addressLine2 || undefined,
                        city: sale.city,
                        state: sale.state,
                        postalCode: sale.postalCode,
                        country: 'India',
                    },
                } : {}),
            });
            setSaleOpen(false);
            showAlert(`Sale recorded: ${(result ?? []).map((order: any) => order.orderNumber).join(', ')}`);
            await load(1, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setSaleBusy(false);
        }
    };

    useEffect(() => {
        dispatch(setPageTitle('Orders'));
        load();
        if (searchParams.get('action') === 'create') {
            void openSale();
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('action');
            setSearchParams(nextParams, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div>
            <AdminPageHeader
                title="Orders"
                subtitle="All buyer orders across sellers"
                search={search}
                onSearchChange={setSearch}
                onSearch={searchOrders}
                onClear={clearFilters}
                canClear={Boolean(search || statusFilter)}
                onCreate={openSale}
                createLabel="Record sale"
                searchPlaceholder="Search by order number, buyer name, email or mobile"
                filters={
                    <select
                        className="form-select w-full sm:w-auto min-w-[160px] shrink-0"
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

            <AdminFormModal
                open={saleOpen}
                title="Record a sale"
                onClose={() => setSaleOpen(false)}
                onSubmit={createSale}
                submitLabel="Create sale"
                busy={saleBusy}
                size="xl"
            >
                <FormSection title="Customer and fulfillment" className="md:col-span-2">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField label="Customer name" required>
                            <input className="form-input" required value={sale.buyerName} onChange={(e) => setSale({ ...sale, buyerName: e.target.value })} />
                        </FormField>
                        <FormField label="Mobile" required>
                            <input className="form-input" required value={sale.buyerMobile} onChange={(e) => setSale({ ...sale, buyerMobile: e.target.value })} />
                        </FormField>
                        <FormField label="Email">
                            <input className="form-input" type="email" value={sale.buyerEmail} onChange={(e) => setSale({ ...sale, buyerEmail: e.target.value })} />
                        </FormField>
                        <FormField label="Sale channel">
                            <select className="form-select" value={sale.source} onChange={(e) => setSale({ ...sale, source: e.target.value, shippingType: e.target.value === 'ADMIN_COUNTER' ? 'PICKUP' : 'STANDARD', shippingFee: e.target.value === 'ADMIN_COUNTER' ? '0' : sale.shippingFee })}>
                                <option value="ADMIN_COUNTER">Counter sale</option>
                                <option value="ADMIN_PHONE">Phone order</option>
                            </select>
                        </FormField>
                        <FormField label="Fulfillment">
                            <select className="form-select" value={sale.shippingType} onChange={(e) => setSale({ ...sale, shippingType: e.target.value, shippingFee: e.target.value === 'PICKUP' ? '0' : sale.shippingFee })}>
                                <option value="STANDARD">Ship, standard</option>
                                <option value="EXPRESS">Ship, express</option>
                                <option value="SAME_DAY">Ship, same day</option>
                                <option value="PICKUP">Counter pickup</option>
                            </select>
                        </FormField>
                        <FormField label="Payment method">
                            <select className="form-select" value={sale.paymentMethod} onChange={(e) => setSale({ ...sale, paymentMethod: e.target.value, paymentStatus: e.target.value === 'COD' ? 'PENDING' : sale.paymentMethod === 'COD' && sale.paymentStatus === 'PENDING' ? 'SUCCESS' : sale.paymentStatus })}>
                                <option value="CASH">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="CARD">Card</option>
                                <option value="COD">Cash on delivery</option>
                                <option value="BANK_TRANSFER">Bank transfer</option>
                            </select>
                        </FormField>
                        <FormField label="Payment status">
                            <select className="form-select" value={sale.paymentStatus} onChange={(e) => setSale({ ...sale, paymentStatus: e.target.value })}>
                                <option value="SUCCESS">Paid</option>
                                <option value="PENDING">Pending</option>
                            </select>
                        </FormField>
                    </div>
                    {sale.shippingType !== 'PICKUP' ? (
                        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField label="Address" required>
                                <input className="form-input" required value={sale.addressLine1} onChange={(e) => setSale({ ...sale, addressLine1: e.target.value })} />
                            </FormField>
                            <FormField label="Address line 2">
                                <input className="form-input" value={sale.addressLine2} onChange={(e) => setSale({ ...sale, addressLine2: e.target.value })} />
                            </FormField>
                            <FormField label="City" required>
                                <input className="form-input" required value={sale.city} onChange={(e) => setSale({ ...sale, city: e.target.value })} />
                            </FormField>
                            <FormField label="State" required>
                                <input className="form-input" required value={sale.state} onChange={(e) => setSale({ ...sale, state: e.target.value })} />
                            </FormField>
                        <FormField label="Postal code" required>
                            <input className="form-input" required value={sale.postalCode} onChange={(e) => setSale({ ...sale, postalCode: e.target.value })} />
                        </FormField>
                        <FormField label="Delivery charge (INR)" hint="Use the quoted delivery fee. Seller commission is not calculated on this charge.">
                            <input className="form-input" type="number" min="0" step="0.01" value={sale.shippingFee} onChange={(e) => setSale({ ...sale, shippingFee: e.target.value })} />
                        </FormField>
                        </div>
                    ) : null}
                </FormSection>

                <FormSection title="Items" className="md:col-span-2">
                    <div className="space-y-3">
                        {sale.items.map((item, index) => (
                            <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px_40px]">
                                <select aria-label="Product" className="form-select min-w-0" required value={item.productId} onChange={(e) => chooseSaleProduct(index, e.target.value)}>
                                    <option value="">Select product</option>
                                    {catalog.map((product) => (
                                        <option key={product.id} value={product.id}>
                                            {product.name} · ₹{product.price} · stock {product.stockQuantity}
                                        </option>
                                    ))}
                                </select>
                                {item.variants.length ? (
                                    <select aria-label="Product option" className="form-select min-w-0" required value={item.variantId} onChange={(e) => setSale({
                                        ...sale,
                                        items: sale.items.map((row, rowIndex) => rowIndex === index ? { ...row, variantId: e.target.value } : row),
                                    })}>
                                        <option value="">Select option</option>
                                        {item.variants.map((variant: any) => <option key={variant.id} value={variant.id}>{variant.name} · ₹{variant.price} · stock {variant.stockQuantity}</option>)}
                                    </select>
                                ) : <div className="hidden sm:block" />}
                                <input aria-label="Quantity" className="form-input" type="number" min="1" required value={item.quantity} onChange={(e) => setSale({
                                    ...sale,
                                    items: sale.items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Number(e.target.value) } : row),
                                })} />
                                <button type="button" className="btn btn-outline-danger h-10 w-10 p-2" aria-label="Remove item" title="Remove item" disabled={sale.items.length === 1} onClick={() => setSale({ ...sale, items: sale.items.filter((_, rowIndex) => rowIndex !== index) })}><IconX className="h-4 w-4" /></button>
                            </div>
                        ))}
                        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setSale({ ...sale, items: [...sale.items, { productId: '', variantId: '', variants: [], quantity: 1 }] })}>Add item</button>
                    </div>
                </FormSection>
            </AdminFormModal>

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger" role="alert">{error}</div> : null}

            <AdminDataTable
                columns={[
                    {
                        key: 'orderNumber',
                        label: 'Order',
                        sortable: true,
                        sortValue: (row) => row.orderNumber,
                        render: (row) => (
                            <div>
                                <div className="font-semibold">{row.orderNumber}</div>
                                <div className="text-xs text-white-dark">{new Date(row.createdAt).toLocaleString()}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'source',
                        label: 'Channel',
                        render: (row) => ({
                            ADMIN_COUNTER: 'Counter',
                            ADMIN_PHONE: 'Phone',
                            ADMIN_MANUAL: 'Admin sale',
                        } as Record<string, string>)[row.source] || 'Online',
                    },
                    {
                        key: 'buyer',
                        label: 'Buyer',
                        render: (row) => (
                            <div>
                                <div>{row.buyer?.fullName ?? '—'}</div>
                                <div className="text-xs text-white-dark">{row.buyer?.email ?? row.buyer?.mobile ?? ''}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'seller',
                        label: 'Seller',
                        render: (row) => row.seller?.businessName ?? '—',
                    },
                    {
                        key: 'itemCount',
                        label: 'Items',
                        sortable: true,
                        sortValue: (row) => row.itemCount,
                        render: (row) => row.itemCount,
                    },
                    {
                        key: 'totalAmount',
                        label: 'Total',
                        sortable: true,
                        sortValue: (row) => Number(row.totalAmount),
                        render: (row) => `₹${row.totalAmount}`,
                    },
                    {
                        key: 'paymentStatus',
                        label: 'Payment',
                        render: (row) => <StatusBadge status={row.paymentStatus} />,
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
                selectable={false}
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
                    <RowActionsMenu actions={[{ label: 'View', onClick: () => navigate(`/admin/orders/${row.id}`) }]} />
                )}
            />
        </div>
    );
}
