import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { AdminDataTable, AdminPageHeader } from '../../components/Admin/AdminTable';
import { RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';

const STATUSES = ['AVAILABLE', 'REQUESTED', 'APPROVED', 'TRANSFERRED', 'CANCELLED'];
const CATEGORIES = ['FURNITURE', 'CLOTHING', 'MEDICAL_EQUIPMENT', 'ELECTRONICS', 'BOOKS_STATIONERY', 'HOUSEHOLD', 'TOYS', 'OTHER'];

export default function AdminDonationItems() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [verifiedFilter, setVerifiedFilter] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = async (
        page = 1,
        size = pageSize,
        filters?: { search?: string; status?: string; category?: string; verified?: string },
    ) => {
        const nextSearch = filters?.search ?? search;
        const nextStatus = filters?.status ?? statusFilter;
        const nextCategory = filters?.category ?? categoryFilter;
        const nextVerified = filters?.verified ?? verifiedFilter;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listDonationItems({
                page,
                limit: size,
                search: nextSearch || undefined,
                status: nextStatus || undefined,
                category: nextCategory || undefined,
                verified: nextVerified || undefined,
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
        setCategoryFilter('');
        setVerifiedFilter('');
        load(1, pageSize, { search: '', status: '', category: '', verified: '' });
    };

    useEffect(() => {
        dispatch(setPageTitle('Donation Items'));
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const verify = async (id: string) => {
        try {
            await adminApi.verifyDonationItem(id);
            showAlert('Donation item approved successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const remove = async (id: string) => {
        const ok = await confirmAction('Delete this donation item?');
        if (!ok) return;
        try {
            await adminApi.deleteDonationItem(id);
            showAlert('Donation item deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Donation Items"
                subtitle="Items users have listed for donation (furniture, clothes, medical equipment, etc.)"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                onClear={clearFilters}
                canClear={Boolean(search || statusFilter || categoryFilter || verifiedFilter)}
                filters={
                    <>
                        <select
                            className="form-select w-full sm:w-auto min-w-[160px] shrink-0"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                load(1, pageSize, { status: e.target.value });
                            }}
                        >
                            <option value="">All statuses</option>
                            {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {status.replace('_', ' ')}
                                </option>
                            ))}
                        </select>
                        <select
                            className="form-select w-full sm:w-auto min-w-[170px] shrink-0"
                            value={categoryFilter}
                            onChange={(e) => {
                                setCategoryFilter(e.target.value);
                                load(1, pageSize, { category: e.target.value });
                            }}
                        >
                            <option value="">All categories</option>
                            {CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                    {category.replace('_', ' ')}
                                </option>
                            ))}
                        </select>
                        <select
                            className="form-select w-full sm:w-auto min-w-[160px] shrink-0"
                            value={verifiedFilter}
                            onChange={(e) => {
                                setVerifiedFilter(e.target.value);
                                load(1, pageSize, { verified: e.target.value });
                            }}
                        >
                            <option value="">All listings</option>
                            <option value="true">Verified</option>
                            <option value="false">Pending review</option>
                        </select>
                    </>
                }
            />

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

            <AdminDataTable
                selectable={false}
                columns={[
                    {
                        key: 'title',
                        label: 'Item',
                        render: (row) => (
                            <div>
                                <div className="font-semibold">{row.title}</div>
                                <div className="text-xs text-white-dark">{(row.category ?? '—').toString().replace('_', ' ')} · {row.condition}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'donor',
                        label: 'Donor',
                        render: (row) => (
                            <div>
                                <div>{row.donor?.fullName ?? '—'}</div>
                                <div className="text-xs text-white-dark">{row.donor?.mobileMasked ?? '—'}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'pickup',
                        label: 'Pickup Location',
                        render: (row) => `${row.pickupCity}, ${row.pickupState}`,
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        render: (row) => <StatusBadge status={row.status} />,
                    },
                    {
                        key: 'verified',
                        label: 'Review',
                        render: (row) => (row.isVerified ? <StatusBadge status="VERIFIED" /> : <StatusBadge status="PENDING" />),
                    },
                    {
                        key: 'createdAt',
                        label: 'Listed On',
                        sortable: true,
                        sortValue: (row) => row.createdAt,
                        render: (row) => new Date(row.createdAt).toLocaleDateString(),
                    },
                ]}
                rows={items}
                loading={loading}
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
                            { label: 'View', onClick: () => navigate(`/admin/donation-items/${row.id}`) },
                            ...(!row.isVerified ? [{ label: 'Approve', onClick: () => verify(row.id) }] : []),
                            { label: 'Delete', onClick: () => remove(row.id), danger: true },
                        ]}
                    />
                )}
            />
        </div>
    );
}
