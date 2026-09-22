import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage, mediaUrl } from '../../services/api';
import { AdminDataTable } from '../../components/Admin/AdminTable';
import { RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { promptReason, showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';

export default function ProductDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [product, setProduct] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reviewBusy, setReviewBusy] = useState(false);

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
            { label: 'Commission override', value: product.commissionRate == null ? 'Inherited' : `${product.commissionRate}%` },
            { label: 'Cash on delivery', value: product.allowCod ? 'Allowed' : 'Disabled' },
            { label: 'Returns', value: product.isReturnable ? `${product.returnDays} days` : 'Not returnable' },
        ];
    }, [product, ordersMeta.total]);

    const approve = async () => {
        if (!product) return;
        setReviewBusy(true);
        try {
            await adminApi.approveProduct(product.id);
            showAlert('Product approved successfully');
            await loadProduct();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setReviewBusy(false);
        }
    };

    const reject = async () => {
        if (!product) return;
        const reason = await promptReason('Rejection reason');
        if (!reason) return;
        setReviewBusy(true);
        try {
            await adminApi.rejectProduct(product.id, reason);
            showAlert('Product rejected');
            await loadProduct();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setReviewBusy(false);
        }
    };

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
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                    <Link to="/admin/products" className="btn btn-outline-primary p-2 mt-0.5" aria-label="Back">
                        <IconArrowLeft className="w-4.5 h-4.5" />
                    </Link>
                    <div>
                        <h2 className="text-xl font-semibold dark:text-white-light">{product.name}</h2>
                        <p className="text-white-dark text-sm mt-1">{product.shortDescription || product.brand || 'Product detail and order history'}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={product.status} />
                    {product.status === 'PENDING_REVIEW' ? (
                        <>
                            <button type="button" className="btn btn-outline-danger" disabled={reviewBusy} onClick={reject}>
                                Reject product
                            </button>
                            <button type="button" className="btn btn-primary" disabled={reviewBusy} onClick={approve}>
                                {reviewBusy ? 'Reviewing...' : 'Approve product'}
                            </button>
                        </>
                    ) : null}
                </div>
            </div>

            {product.status === 'PENDING_REVIEW' ? (
                <div className="product-review-banner mb-5" role="status">
                    This seller listing is awaiting review. Check its images, description, shipping details, and return policy before approving.
                </div>
            ) : null}

            <div className="product-detail-grid mb-5">
                <section className="panel min-w-0">
                    <h3 className="mb-4 text-base font-semibold">Product images</h3>
                    {Array.isArray(product.images) && product.images.length ? (
                        <div className="product-image-grid">
                            {product.images.map((image: any) => (
                                <figure key={image.id}>
                                    <img src={mediaUrl(image.url)} alt={image.altText || product.name} loading="lazy" />
                                    {image.isPrimary ? <figcaption>Primary image</figcaption> : null}
                                </figure>
                            ))}
                        </div>
                    ) : (
                        <div className="product-images-empty">No product images were submitted.</div>
                    )}
                    <div className="mt-6 border-t border-[#ebedf2] pt-5 dark:border-[#303936]">
                        <h3 className="mb-2 text-base font-semibold">Description</h3>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-white-dark">{product.description || 'No description provided.'}</p>
                    </div>
                </section>

                <section className="panel min-w-0">
                    <h3 className="mb-4 text-base font-semibold">Listing details</h3>
                    <dl className="admin-detail-facts">
                        {infoCards.map((fact) => (
                            <div key={fact.label}>
                                <dt>{fact.label}</dt>
                                <dd>{fact.value}</dd>
                            </div>
                        ))}
                    </dl>
                    <div className="mt-6 border-t border-[#ebedf2] pt-5 dark:border-[#303936]">
                        <h3 className="mb-3 text-base font-semibold">Shipping and policies</h3>
                        <dl className="admin-detail-facts">
                            <div><dt>Packed weight</dt><dd>{product.weightGrams ? `${product.weightGrams} g` : 'Not provided'}</dd></div>
                            <div><dt>Package dimensions</dt><dd>{[product.lengthCm, product.widthCm, product.heightCm].every((value) => value != null) ? `${product.lengthCm} × ${product.widthCm} × ${product.heightCm} cm` : 'Not provided'}</dd></div>
                            <div><dt>Tags</dt><dd>{product.tags?.length ? product.tags.join(', ') : '—'}</dd></div>
                            <div><dt>Rejection reason</dt><dd>{product.rejectionReason || '—'}</dd></div>
                        </dl>
                    </div>
                </section>
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
