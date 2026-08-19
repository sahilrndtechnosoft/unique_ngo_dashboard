import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage, mediaUrl } from '../../services/api';
import { AdminDataTable } from '../../components/Admin/AdminTable';
import { RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';

export default function ProductDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [product, setProduct] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [orders, setOrders] = useState<any[]>([]);
    const [ordersMeta, setOrdersMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [ordersPageSize, setOrdersPageSize] = useState(10);
    const [ordersLoading, setOrdersLoading] = useState(false);

    const loadProduct = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const data = (await adminApi.getProduct(id)) as any;
            setProduct(data);
            dispatch(setPageTitle(data.name || 'Product Detail'));
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadOrders = async (page = 1, size = ordersPageSize) => {
        if (!id) return;
        setOrdersLoading(true);
        try {
            const data = await adminApi.listOrders({ productId: id, page, limit: size });
            setOrders(data.items ?? []);
            setOrdersMeta(data.meta);
        } catch (err) {
            showAlert(getErrorMessage(err, 'Failed to load orders'), 'error');
        } finally {
            setOrdersLoading(false);
        }
    };

    useEffect(() => {
        loadProduct();
        loadOrders(1, ordersPageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const infoCards = useMemo(() => {
        if (!product) return [];
        return [
            { label: 'SKU', value: product.sku || '—' },
            { label: 'Category', value: product.category?.name || '—' },
            { label: 'Seller', value: product.seller?.businessName || '—' },
            { label: 'Price', value: `₹${product.price}` },
            { label: 'Stock', value: product.stockQuantity },
            { label: 'Status', value: product.status },
            { label: 'Orders', value: ordersMeta.total },
        ];
    }, [product, ordersMeta.total]);

    if (loading) {
        return <div className="panel">Loading product...</div>;
    }

    if (!product) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'Product not found'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/admin/products')}>
                    Back to products
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-start gap-3">
                    <Link to="/admin/products" className="btn btn-outline-primary p-2 mt-0.5" aria-label="Back">
                        <IconArrowLeft className="w-4.5 h-4.5" />
                    </Link>
                    <div className="flex items-center gap-3">
                        {product.images?.[0]?.url ? (
                            <img src={mediaUrl(product.images[0].url)} alt={product.name} className="h-12 w-12 rounded object-cover" />
                        ) : null}
                        <div>
                            <h2 className="text-xl font-semibold dark:text-white-light">{product.name}</h2>
                            <p className="text-white-dark text-sm mt-1">{product.shortDescription || product.brand || 'Product detail and order history'}</p>
                        </div>
                    </div>
                </div>
                <StatusBadge status={product.status} />
            </div>

            <div className="panel mb-5">
                <h5 className="font-semibold text-lg mb-4">Product information</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {infoCards.map((card) => (
                        <div key={card.label} className="rounded border border-[#ebedf2] dark:border-[#191e3a] p-4">
                            <div className="text-xs uppercase tracking-wide text-white-dark mb-1">{card.label}</div>
                            <div className="font-semibold break-all">{card.label === 'Status' ? <StatusBadge status={String(card.value)} /> : card.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-4">
                <h5 className="font-semibold text-lg">Orders containing this Product</h5>
            </div>
            <AdminDataTable
                selectable={false}
                columns={[
                    { key: 'orderNumber', label: 'Order #', render: (row) => <span className="font-semibold">{row.orderNumber}</span> },
                    {
                        key: 'buyer',
                        label: 'Buyer',
                        render: (row) => (
                            <div>
                                <div>{row.buyer?.fullName ?? '—'}</div>
                                <div className="text-xs text-white-dark">{row.buyer?.mobile ?? row.buyer?.email ?? ''}</div>
                            </div>
                        ),
                    },
                    { key: 'totalAmount', label: 'Total', render: (row) => `₹${row.totalAmount}` },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'createdAt', label: 'Placed On', render: (row) => new Date(row.createdAt).toLocaleDateString() },
                ]}
                rows={orders}
                loading={ordersLoading}
                page={ordersMeta.page}
                totalPages={ordersMeta.totalPages}
                total={ordersMeta.total}
                pageSize={ordersPageSize}
                onPageChange={(page) => loadOrders(page, ordersPageSize)}
                onPageSizeChange={(size) => {
                    setOrdersPageSize(size);
                    loadOrders(1, size);
                }}
                actions={(row) => <RowActionsMenu actions={[{ label: 'View', onClick: () => navigate(`/admin/orders/${row.id}`) }]} />}
                emptyText="This product hasn't been ordered yet"
            />
        </div>
    );
}
