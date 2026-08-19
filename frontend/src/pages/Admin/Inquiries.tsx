import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { AdminDataTable, AdminPageHeader } from '../../components/Admin/AdminTable';
import { RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';

const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function AdminInquiries() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = async (page = 1, size = pageSize, filters?: { search?: string; status?: string }) => {
        const nextSearch = filters?.search ?? search;
        const nextStatus = filters?.status ?? statusFilter;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listInquiries({
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
        dispatch(setPageTitle('Inquiries'));
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const remove = async (id: string) => {
        const ok = await confirmAction('Delete this inquiry?');
        if (!ok) return;
        try {
            await adminApi.deleteInquiry(id);
            showAlert('Inquiry deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Inquiries"
                subtitle="Inquiries submitted from the app"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                onClear={clearFilters}
                canClear={Boolean(search || statusFilter)}
                filters={
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
                }
            />

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

            <AdminDataTable
                selectable={false}
                columns={[
                    {
                        key: 'subject',
                        label: 'Subject',
                        render: (row) => (
                            <div>
                                <div className="font-semibold">{row.subject}</div>
                                <div className="text-xs text-white-dark line-clamp-1">{row.message}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'contact',
                        label: 'Contact',
                        render: (row) => (
                            <div>
                                <div>{row.name}</div>
                                <div className="text-xs text-white-dark">{row.email} · {row.mobile}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        render: (row) => <StatusBadge status={row.status} />,
                    },
                    {
                        key: 'createdAt',
                        label: 'Received On',
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
                            { label: 'View', onClick: () => navigate(`/admin/inquiries/${row.id}`) },
                            { label: 'Delete', onClick: () => remove(row.id), danger: true },
                        ]}
                    />
                )}
            />
        </div>
    );
}
