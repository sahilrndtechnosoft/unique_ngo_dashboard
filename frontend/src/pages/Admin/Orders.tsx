import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { useRowSelection } from '../../hooks/useRowSelection';
import { AdminDataTable, AdminPageHeader } from '../../components/Admin/AdminTable';
import { RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
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
    const navigate = useNavigate();
    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
                    <RowActionsMenu actions={[{ label: 'View', onClick: () => navigate(`/admin/orders/${row.id}`) }]} />
                )}
            />
        </div>
    );
}
