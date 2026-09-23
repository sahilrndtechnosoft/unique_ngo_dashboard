import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { AdminDataTable } from '../../components/Admin/AdminTable';
import { DetailFacts, FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';

const STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'];
const formatMoney = (value: number | string | null | undefined) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
}).format(Number(value ?? 0));
const STATUS_TRANSITIONS: Record<string, string[]> = {
    PENDING: ['CONFIRMED', 'PROCESSING', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED'],
    DELIVERED: ['RETURNED', 'REFUNDED'],
    CANCELLED: ['REFUNDED'],
    RETURNED: ['REFUNDED'],
    REFUNDED: [],
};

export default function OrderDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [order, setOrder] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [shippingBusy, setShippingBusy] = useState(false);
    const [couriers, setCouriers] = useState<any[]>([]);
    const [selectedCourierId, setSelectedCourierId] = useState('');
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
        setCouriers([]);
        setSelectedCourierId('');
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

    const createShipment = async () => {
        if (!order) return;
        setShippingBusy(true);
        try {
            const result = await adminApi.fulfillOrderWithShiprocket(order.id, selectedCourierId ? Number(selectedCourierId) : undefined) as any;
            setOrder({ ...order, tracking: { ...order.tracking, ...result } });
            showAlert(result?.trackingNumber
                ? 'Shipment created and AWB assigned'
                : result?.status === 'AWB_ASSIGNING'
                    ? 'AWB assignment is still processing. Check provider status shortly.'
                    : 'Provider shipment status refreshed');
            await loadOrder();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
            await loadOrder();
        } finally {
            setShippingBusy(false);
        }
    };

    const findCouriers = async () => {
        if (!order) return;
        setShippingBusy(true);
        try {
            const result = await adminApi.getShiprocketCouriers(order.id) as any;
            const options = Array.isArray(result?.items) ? result.items : [];
            setCouriers(options);
            setSelectedCourierId('');
            if (!options.length) showAlert('No couriers are available for this route and package', 'warning');
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setShippingBusy(false);
        }
    };

    const cancelShipment = async () => {
        if (!order || !(await confirmAction(
            'Cancel Shiprocket fulfillment?',
            'This cancels the AWB or carrier order. The carrier may reject cancellation after pickup. If this order stays active, you can create a replacement shipment afterward.',
            'Cancel fulfillment',
        ))) return;
        setShippingBusy(true);
        try {
            await adminApi.cancelShiprocketShipment(order.id);
            showAlert('Shiprocket shipment cancelled');
            await loadOrder();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
            await loadOrder();
        } finally {
            setShippingBusy(false);
        }
    };

    const refreshShipment = async () => {
        if (!order) return;
        setShippingBusy(true);
        try {
            await adminApi.refreshShiprocketTracking(order.id);
            await loadOrder();
            showAlert('Shipment tracking refreshed');
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setShippingBusy(false);
        }
    };

    const infoCards = useMemo(() => {
        if (!order) return [];
        return [
            { label: 'Buyer', value: order.buyer?.fullName || '—' },
            { label: 'Channel', value: ({ ADMIN_COUNTER: 'Counter sale', ADMIN_PHONE: 'Phone order', ADMIN_MANUAL: 'Admin sale' } as Record<string, string>)[order.source] || 'Online' },
            { label: 'Seller', value: order.seller?.businessName || '—' },
            { label: 'Payment', value: `${order.paymentMethod} · ${order.paymentStatus}` },
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

    const statusTransitions = new Set([
        ...(STATUS_TRANSITIONS[order.status] ?? []),
        ...(order.shippingType === 'PICKUP' && order.status === 'PROCESSING' ? ['DELIVERED'] : []),
    ]);
    const shipmentPaymentResolved = (
        order.paymentStatus === 'SUCCESS' ||
        (order.paymentMethod === 'COD' && !['FAILED', 'CANCELLED', 'REFUNDED'].includes(order.paymentStatus))
    );
    const canShipOrder = ['CONFIRMED', 'PROCESSING'].includes(order.status) && shipmentPaymentResolved;
    const shipmentBlockReason = !['CONFIRMED', 'PROCESSING'].includes(order.status)
        ? 'Confirm or start processing this order before creating a shipment.'
        : !shipmentPaymentResolved
            ? 'Resolve the payment status before creating a shipment.'
            : '';
    if (order.shippingType === 'PICKUP' || !order.tracking?.trackingNumber) {
        statusTransitions.delete('SHIPPED');
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

            {order.reconciliationIssues?.length > 0 && (
                <div role="status" className="mb-5 rounded-md border border-warning/40 bg-warning/10 p-4 text-sm dark:text-white-light">
                    <h3 className="font-semibold">Reconciliation required</h3>
                    <p className="mt-1">Recorded amounts are preserved. Financial totals may be incomplete until these issues are reviewed.</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                        {order.reconciliationIssues.map((issue: string) => <li key={issue}>{issue}</li>)}
                    </ul>
                </div>
            )}

            <div className="panel mb-5">
                <h5 className="font-semibold text-lg mb-4">Order information</h5>
                <DetailFacts items={infoCards.map((card) => ({
                    ...card,
                    value: card.label === 'Status' ? <StatusBadge status={String(card.value)} /> : card.value,
                }))} />
            </div>

            <div className="panel mb-5">
                <FormSection title="Financial summary" description="Commission is calculated per item after discounts, excluding tax and shipping.">
                    <DetailFacts items={[
                        { label: 'Item subtotal', value: formatMoney(order.subtotal) },
                        { label: 'Discount', value: `−${formatMoney(order.discountAmount)}` },
                        { label: 'Tax', value: formatMoney(order.taxAmount) },
                        { label: 'Shipping', value: formatMoney(order.shippingFee) },
                        { label: 'Order total', value: formatMoney(order.totalAmount) },
                        { label: 'Platform commission', value: formatMoney(order.commissionAmount) },
                        { label: 'Seller payout', value: formatMoney(order.sellerPayout) },
                        { label: 'Payout status', value: order.sellerId ? order.payoutStatus : 'Not applicable' },
                    ]} />
                </FormSection>
            </div>

            <div className="panel mb-5">
                <FormSection title="Update status">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField label="Status">
                            <select className="form-select" value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>
                                {STATUSES.filter((status) => status === order.status || statusTransitions.has(status)).map((status) => (
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
                    <button type="button" className="btn btn-primary btn-sm mt-3" disabled={busy || statusForm.status === order.status} onClick={updateStatus}>
                        {busy ? 'Updating...' : 'Update status'}
                    </button>
                </FormSection>
            </div>

            <div className="panel mb-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h5 className="font-semibold">Shipping and tracking</h5>
                        {order.tracking?.provider ? (
                            <div className="mt-3 space-y-1 text-sm">
                                <p>{order.tracking.carrier || 'Shiprocket'}{order.tracking.trackingNumber ? ` · ${order.tracking.trackingNumber}` : ''}</p>
                                <p className="text-white-dark">{order.tracking.status}</p>
                                {order.tracking.status === 'CANCELLED' && canShipOrder ? (
                                    <p className="text-white-dark" role="status">The carrier shipment was cancelled. You can create a replacement shipment for this active order.</p>
                                ) : null}
                                {order.tracking.status === 'CREATE_UNCERTAIN' ? (
                                    <p className="text-warning" role="alert">The provider response was interrupted. Check provider status before retrying so a second shipment is not created.</p>
                                ) : null}
                                {order.tracking.status === 'CANCEL_UNCERTAIN' ? (
                                    <p className="text-warning" role="alert">The cancellation response was interrupted. Check Shiprocket before another cancellation request is sent.</p>
                                ) : null}
                                {order.tracking.status === 'AWB_ASSIGNING' ? (
                                    <p className="text-warning" role="status">Shiprocket is assigning the AWB. Check provider status again shortly.</p>
                                ) : null}
                                {order.tracking.shipmentError ? <p className="text-danger">{order.tracking.shipmentError}</p> : null}
                            </div>
                        ) : <p className="mt-2 text-sm text-white-dark">No carrier shipment created yet.</p>}
                    </div>
                    {order.shippingType !== 'PICKUP' && (!order.tracking?.providerShipmentId || order.tracking?.status === 'CANCELLED') && canShipOrder ? (
                        <div className="mt-4 max-w-xl space-y-3">
                            <button type="button" className="btn btn-outline-primary" disabled={shippingBusy} onClick={findCouriers}>
                                {shippingBusy ? 'Checking availability...' : 'Check courier rates'}
                            </button>
                            {couriers.length ? (
                                <FormField label="Courier and estimated rate" hint="This carrier quote does not change the order total or customer shipping charge.">
                                    <select className="form-select" value={selectedCourierId} onChange={(event) => setSelectedCourierId(event.target.value)}>
                                        <option value="">Let Shiprocket select the courier</option>
                                        {couriers.map((courier) => (
                                            <option key={courier.courierCompanyId} value={courier.courierCompanyId}>
                                                {courier.courierName} · ₹{courier.freightCharge}{courier.estimatedDeliveryDays ? ` · ${courier.estimatedDeliveryDays} days` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </FormField>
                            ) : null}
                        </div>
                    ) : null}
                    {order.shippingType !== 'PICKUP' && !order.tracking?.providerShipmentId && shipmentBlockReason ? (
                        <p className="mt-3 text-sm text-white-dark" role="status">{shipmentBlockReason}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                        {order.shippingType !== 'PICKUP' && canShipOrder && (!order.tracking?.providerShipmentId || order.tracking?.status === 'CANCELLED' || (!order.tracking?.trackingNumber && ['CREATE_UNCERTAIN', 'CREATED', 'AWB_FAILED', 'AWB_ASSIGNING', 'FAILED'].includes(order.tracking?.status))) ? (
                            <button type="button" className="btn btn-primary" disabled={shippingBusy} onClick={createShipment}>
                                {shippingBusy
                                    ? 'Processing...'
                                    : ['CREATE_UNCERTAIN', 'AWB_ASSIGNING'].includes(order.tracking?.status)
                                        ? 'Check provider status'
                                        : order.tracking?.status === 'CANCELLED'
                                            ? 'Create replacement shipment'
                                            : order.tracking?.providerShipmentId
                                            ? 'Retry AWB assignment'
                                            : 'Create Shiprocket shipment'}
                            </button>
                        ) : null}
                        {order.tracking?.providerShipmentId && order.tracking?.trackingNumber && order.tracking?.status !== 'CANCELLED' ? (
                            <button type="button" className="btn btn-outline-primary" disabled={shippingBusy} onClick={refreshShipment}>
                                {shippingBusy ? 'Refreshing...' : 'Refresh tracking'}
                            </button>
                        ) : null}
                        {order.tracking?.trackingUrl ? <a className="btn btn-outline-primary" href={order.tracking.trackingUrl} target="_blank" rel="noreferrer">Track</a> : null}
                        {order.tracking?.labelUrl ? <a className="btn btn-outline-primary" href={order.tracking.labelUrl} target="_blank" rel="noreferrer">Shipping label</a> : null}
                        {order.tracking?.manifestUrl ? <a className="btn btn-outline-primary" href={order.tracking.manifestUrl} target="_blank" rel="noreferrer">Manifest</a> : null}
                        {order.tracking?.provider === 'SHIPROCKET' && (order.tracking?.trackingNumber || order.tracking?.providerOrderId) && order.tracking?.status !== 'CANCELLED' && !['DELIVERED', 'RETURNED'].includes(order.status) ? (
                            <button type="button" className="btn btn-outline-danger" disabled={shippingBusy} onClick={cancelShipment}>
                                {shippingBusy ? 'Updating shipment...' : order.tracking?.status === 'CANCEL_UNCERTAIN' ? 'Check cancellation status' : 'Cancel fulfillment'}
                            </button>
                        ) : null}
                    </div>
                </div>
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
                                    <th>Discount</th>
                                    <th>Tax</th>
                                    <th>Commission</th>
                                    <th>Seller payout</th>
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
                                        <td>{formatMoney(item.unitPrice)}</td>
                                        <td>{formatMoney(item.discountAmount)}</td>
                                        <td>{formatMoney(item.taxAmount)}</td>
                                        <td>
                                            {item.commissionRate === null || item.commissionRate === undefined
                                                ? '—'
                                                : `${item.commissionRate}% · ${formatMoney(item.commissionAmount)}`}
                                        </td>
                                        <td>{item.sellerPayout === null || item.sellerPayout === undefined ? '—' : formatMoney(item.sellerPayout)}</td>
                                        <td>{formatMoney(item.totalPrice)}</td>
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

                {Array.isArray(order.tracking?.events) && order.tracking.events.length ? (
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
