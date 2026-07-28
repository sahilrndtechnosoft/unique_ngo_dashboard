import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { useRowSelection } from '../../hooks/useRowSelection';
import { AdminDataTable, AdminPageHeader } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { showAlert } from '../../utils/alerts';

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

export default function AdminOrders() {
    const dispatch = useDispatch();
    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [statusForm, setStatusForm] = useState({ status: '', note: '', location: '' });

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
        load(1, pageSize, { search: '', status: '' });
    };

    useEffect(() => {
        dispatch(setPageTitle('Orders'));
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const viewOrder = async (id: string) => {
        setBusy(true);
        try {
            const order = (await adminApi.getOrder(id)) as any;
            setSelectedOrder(order);
            setStatusForm({ status: order.status, note: '', location: '' });
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const closeView = () => setSelectedOrder(null);

    const updateStatus = async () => {
        if (!selectedOrder) return;
        setBusy(true);
        try {
            const updated = await adminApi.updateOrderStatus(selectedOrder.id, {
                status: statusForm.status,
                note: statusForm.note || undefined,
                location: statusForm.location || undefined,
            });
            setSelectedOrder(updated);
            showAlert('Order status updated successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Orders"
                subtitle="All buyer orders across sellers"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                onClear={clearFilters}
                canClear={Boolean(search || statusFilter)}
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

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

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
                    <RowActionsMenu actions={[{ label: 'View', onClick: () => viewOrder(row.id) }]} />
                )}
            />

            <AdminFormModal open={selectedOrder !== null} title={`Order ${selectedOrder?.orderNumber ?? ''}`} onClose={closeView} readOnly size="xl">
                {selectedOrder ? (
                    <>
                        <FormSection title="Overview">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-white-dark">Buyer</div>
                                    <div>{selectedOrder.buyer?.fullName ?? '—'}</div>
                                </div>
                                <div>
                                    <div className="text-white-dark">Seller</div>
                                    <div>{selectedOrder.seller?.businessName ?? '—'}</div>
                                </div>
                                <div>
                                    <div className="text-white-dark">Payment</div>
                                    <div>
                                        {selectedOrder.paymentMethod} · <StatusBadge status={selectedOrder.paymentStatus} />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-white-dark">Total</div>
                                    <div>₹{selectedOrder.totalAmount}</div>
                                </div>
                            </div>
                        </FormSection>

                        <FormSection title="Update status" className="mt-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField label="Status">
                                    <select
                                        className="form-select"
                                        value={statusForm.status}
                                        onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                                    >
                                        {STATUSES.map((status) => (
                                            <option key={status} value={status}>
                                                {status}
                                            </option>
                                        ))}
                                    </select>
                                </FormField>
                                <FormField label="Location" hint="Optional, shown to buyer">
                                    <input
                                        className="form-input"
                                        value={statusForm.location}
                                        onChange={(e) => setStatusForm({ ...statusForm, location: e.target.value })}
                                    />
                                </FormField>
                                <FormField label="Note" hint="Optional, shown to buyer">
                                    <input
                                        className="form-input"
                                        value={statusForm.note}
                                        onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })}
                                    />
                                </FormField>
                            </div>
                            <button type="button" className="btn btn-primary btn-sm mt-3" disabled={busy} onClick={updateStatus}>
                                {busy ? 'Updating...' : 'Update status'}
                            </button>
                        </FormSection>

                        <FormSection title="Items" className="mt-5 md:col-span-2">
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
                                        {(selectedOrder.items ?? []).map((item: any) => (
                                            <tr key={item.id}>
                                                <td>
                                                    {item.productName}
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

                        {selectedOrder.shippingAddress ? (
                            <FormSection title="Shipping address" className="mt-5">
                                <div className="text-sm">
                                    <div>{selectedOrder.shippingAddress.fullName}</div>
                                    <div>{selectedOrder.shippingAddress.mobile}</div>
                                    <div>
                                        {selectedOrder.shippingAddress.addressLine1}
                                        {selectedOrder.shippingAddress.addressLine2 ? `, ${selectedOrder.shippingAddress.addressLine2}` : ''}
                                    </div>
                                    <div>
                                        {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.postalCode}
                                    </div>
                                </div>
                            </FormSection>
                        ) : null}

                        {selectedOrder.tracking?.events?.length ? (
                            <FormSection title="Tracking history" className="mt-5 md:col-span-2">
                                <ul className="space-y-2 text-sm">
                                    {selectedOrder.tracking.events.map((event: any, index: number) => (
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
                    </>
                ) : null}
            </AdminFormModal>
        </div>
    );
}
