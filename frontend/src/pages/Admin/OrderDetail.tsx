import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { AdminDataTable } from '../../components/Admin/AdminTable';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';

const STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'];

export default function OrderDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [order, setOrder] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [statusForm, setStatusForm] = useState({ status: '', note: '', location: '' });

    const [history, setHistory] = useState<any[]>([]);
    const [historyMeta, setHistoryMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [historyPageSize, setHistoryPageSize] = useState(10);
    const [historyLoading, setHistoryLoading] = useState(false);

    const loadOrder = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const data = (await adminApi.getOrder(id)) as any;
            setOrder(data);
            setStatusForm({ status: data.status, note: '', location: '' });
            dispatch(setPageTitle(data.orderNumber || 'Order Detail'));
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async (page = 1, size = historyPageSize, buyerId?: string) => {
        const targetBuyerId = buyerId ?? order?.buyerId;
        if (!targetBuyerId) return;
        setHistoryLoading(true);
        try {
            const data = await adminApi.listOrders({ buyerId: targetBuyerId, page, limit: size });
            setHistory(data.items ?? []);
            setHistoryMeta(data.meta);
        } catch (err) {
            showAlert(getErrorMessage(err, "Failed to load buyer's order history"), 'error');
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        loadOrder();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        if (order?.buyerId) {
            loadHistory(1, historyPageSize, order.buyerId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order?.buyerId]);

    const updateStatus = async () => {
        if (!order) return;
        setBusy(true);
        try {
            const updated = await adminApi.updateOrderStatus(order.id, {
                status: statusForm.status,
                note: statusForm.note || undefined,
                location: statusForm.location || undefined,
            });
            setOrder(updated);
            showAlert('Order status updated successfully');
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const infoCards = useMemo(() => {
        if (!order) return [];
        return [
            { label: 'Buyer', value: order.buyer?.fullName || '—' },
            { label: 'Seller', value: order.seller?.businessName || '—' },
            { label: 'Payment', value: `${order.paymentMethod} · ${order.paymentStatus}` },
            { label: 'Total', value: `₹${order.totalAmount}` },
            { label: 'Items', value: order.items?.length ?? 0 },
            { label: 'Status', value: order.status },
        ];
    }, [order]);

    if (loading) {
        return <div className="panel">Loading order...</div>;
    }

    if (!order) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'Order not found'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/admin/orders')}>
                    Back to orders
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-start gap-3">
                    <Link to="/admin/orders" className="btn btn-outline-primary p-2 mt-0.5" aria-label="Back">
                        <IconArrowLeft className="w-4.5 h-4.5" />
                    </Link>
                    <div>
                        <h2 className="text-xl font-semibold dark:text-white-light">Order {order.orderNumber}</h2>
                        <p className="text-white-dark text-sm mt-1">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                </div>
                <StatusBadge status={order.status} />
            </div>

            <div className="panel mb-5">
                <h5 className="font-semibold text-lg mb-4">Order information</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {infoCards.map((card) => (
                        <div key={card.label} className="rounded border border-[#ebedf2] dark:border-[#191e3a] p-4">
                            <div className="text-xs uppercase tracking-wide text-white-dark mb-1">{card.label}</div>
                            <div className="font-semibold break-all">{card.label === 'Status' ? <StatusBadge status={String(card.value)} /> : card.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="panel mb-5">
                <FormSection title="Update status">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField label="Status">
                            <select className="form-select" value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>
                                {STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Location" hint="Optional, shown to buyer">
                            <input className="form-input" value={statusForm.location} onChange={(e) => setStatusForm({ ...statusForm, location: e.target.value })} />
                        </FormField>
                        <FormField label="Note" hint="Optional, shown to buyer">
                            <input className="form-input" value={statusForm.note} onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })} />
                        </FormField>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm mt-3" disabled={busy} onClick={updateStatus}>
                        {busy ? 'Updating...' : 'Update status'}
                    </button>
                </FormSection>
            </div>

            <div className="panel mb-5">
                <FormSection title="Items">
                    <div className="overflow-x-auto">
                        <table className="table-striped text-sm">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Unit price</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(order.items ?? []).map((item: any) => (
                                    <tr key={item.id}>
                                        <td>
                                            <button type="button" className="text-primary hover:underline" onClick={() => navigate(`/admin/products/${item.productId}`)}>
                                                {item.productName}
                                            </button>
                                            {item.variantName ? ` (${item.variantName})` : ''}
                                        </td>
                                        <td>{item.quantity}</td>
                                        <td>₹{item.unitPrice}</td>
                                        <td>₹{item.totalPrice}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </FormSection>

                {order.shippingAddress ? (
                    <FormSection title="Shipping address" className="mt-5">
                        <div className="text-sm">
                            <div>{order.shippingAddress.fullName}</div>
                            <div>{order.shippingAddress.mobile}</div>
                            <div>
                                {order.shippingAddress.addressLine1}
                                {order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ''}
                            </div>
                            <div>
                                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                            </div>
                        </div>
                    </FormSection>
                ) : null}

                {order.tracking?.events?.length ? (
                    <FormSection title="Tracking history" className="mt-5">
                        <ul className="space-y-2 text-sm">
                            {order.tracking.events.map((event: any, index: number) => (
                                <li key={index} className="flex items-center justify-between border-b border-[#ebedf2] pb-2 dark:border-[#191e3a]">
                                    <div>
                                        <StatusBadge status={event.status} />
                                        {event.location ? <span className="ml-2 text-white-dark">{event.location}</span> : null}
                                        {event.description ? <span className="ml-2">{event.description}</span> : null}
                                    </div>
                                    <span className="text-xs text-white-dark">{new Date(event.occurredAt).toLocaleString()}</span>
                                </li>
                            ))}
                        </ul>
                    </FormSection>
                ) : null}
            </div>

            <div className="mb-4">
                <h5 className="font-semibold text-lg">This Buyer's Other Orders</h5>
            </div>
            <AdminDataTable
                selectable={false}
                columns={[
                    { key: 'orderNumber', label: 'Order #', render: (row) => <span className="font-semibold">{row.orderNumber}</span> },
                    { key: 'itemCount', label: 'Items', render: (row) => row.itemCount },
                    { key: 'totalAmount', label: 'Total', render: (row) => `₹${row.totalAmount}` },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'createdAt', label: 'Placed On', render: (row) => new Date(row.createdAt).toLocaleDateString() },
                ]}
                rows={history}
                loading={historyLoading}
                page={historyMeta.page}
                totalPages={historyMeta.totalPages}
                total={historyMeta.total}
                pageSize={historyPageSize}
                onPageChange={(page) => loadHistory(page, historyPageSize)}
                onPageSizeChange={(size) => {
                    setHistoryPageSize(size);
                    loadHistory(1, size);
                }}
                actions={(row) => (
                    <RowActionsMenu actions={[{ label: 'View', onClick: () => navigate(`/admin/orders/${row.id}`) }]} />
                )}
                emptyText="No other orders from this buyer"
            />
        </div>
    );
}
