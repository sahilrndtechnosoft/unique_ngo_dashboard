import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { AdminColumn, AdminDataTable, AdminPageHeader } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { showAlert } from '../../utils/alerts';

export interface RedemptionRow {
    id: string;
    userId: string;
    user?: { id: string; name?: string; email?: string; mobile?: string } | null;
    pointsUsed: number;
    monetaryValue: number;
    status: string;
    failureReason?: string;
    createdAt: string;
    voucher?: { id: string; code: string; title: string } | null;
}

export default function AdminRedemptions() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [items, setItems] = useState<RedemptionRow[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [statusFilter, setStatusFilter] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // Refund Modal state
    const [refundingItem, setRefundingItem] = useState<RedemptionRow | null>(null);
    const [refundReason, setRefundReason] = useState('');

    const load = async (page = 1, size = pageSize, status = statusFilter) => {
        setLoading(true);
        setError('');
        try {
            const res = await adminApi.listRedemptions({
                page,
                limit: size,
                status: status || undefined,
            });
            setItems(res.items);
            setMeta(res.meta);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        dispatch(setPageTitle('Points Redemptions'));
        load(1, pageSize);
    }, [dispatch]);

    const handleRefundSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!refundingItem) return;
        setBusy(true);
        try {
            await adminApi.refundRedemption(refundingItem.id, refundReason);
            showAlert('Redemption refunded and user points restored successfully');
            setRefundingItem(null);
            setRefundReason('');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const columns: AdminColumn<RedemptionRow>[] = [
        {
            key: 'user',
            label: 'Member',
            render: (row) => (
                <div>
                    <Link
                        to={`/admin/redemptions/${row.id}`}
                        className="font-semibold text-gray-900 dark:text-white-dark hover:text-primary transition-colors"
                    >
                        {row.user?.name || row.user?.email || 'User'}
                    </Link>
                    <div className="text-xs text-white-dark">{row.user?.mobile || row.userId}</div>
                </div>
            ),
        },
        {
            key: 'points',
            label: 'Points Spent',
            render: (row) => (
                <div>
                    <span className="font-bold text-primary">{row.pointsUsed} pts</span>
                    <span className="text-xs text-white-dark block">₹{row.monetaryValue}</span>
                </div>
            ),
        },
        {
            key: 'voucher',
            label: 'Voucher Code',
            render: (row) => (
                <div>
                    <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {row.voucher?.code || '—'}
                    </span>
                    {row.voucher?.title ? (
                        <span className="text-xs text-white-dark block truncate max-w-[200px]">
                            {row.voucher.title}
                        </span>
                    ) : null}
                </div>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => <StatusBadge status={row.status} />,
        },
        {
            key: 'date',
            label: 'Redeemed At',
            render: (row) => new Date(row.createdAt).toLocaleString(),
        },
    ];

    return (
        <div>
            <AdminPageHeader
                title="Points Redemptions"
                subtitle="Live audit trail of user point redemptions, vouchers issued, and partner fulfillment"
                search=""
                onSearchChange={() => {}}
                onSearch={() => {}}
                onClear={() => {}}
                filters={
                    <select
                        className="form-select w-full sm:w-auto min-w-[160px] shrink-0"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            load(1, pageSize, e.target.value);
                        }}
                    >
                        <option value="">All Statuses</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="FAILED">Failed</option>
                        <option value="REFUNDED">Refunded</option>
                        <option value="PROCESSING">Processing</option>
                    </select>
                }
            />

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

            <AdminDataTable<RedemptionRow>
                columns={columns}
                rows={items}
                loading={loading}
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                pageSize={pageSize}
                onPageChange={(p) => load(p, pageSize)}
                onPageSizeChange={(s) => {
                    setPageSize(s);
                    load(1, s);
                }}
                actions={(row) => (
                    <RowActionsMenu
                        actions={[
                            { label: 'View Details', onClick: () => navigate(`/admin/redemptions/${row.id}`) },
                            ...(row.status === 'COMPLETED'
                                ? [
                                      {
                                          label: 'Refund & Restore Points',
                                          onClick: () => {
                                              setRefundingItem(row);
                                              setRefundReason('');
                                          },
                                          danger: true,
                                      },
                                  ]
                                : []),
                        ]}
                    />
                )}
            />

            <AdminFormModal
                open={refundingItem !== null}
                title="Refund Redemption & Restore Points"
                onClose={() => setRefundingItem(null)}
                onSubmit={handleRefundSubmit}
                busy={busy}
                size="md"
            >
                <FormSection
                    title="Confirm Refund"
                    description={`This will refund ${refundingItem?.pointsUsed} points back to the user's wallet, restore catalog stock, and void the issued voucher.`}
                    className="md:col-span-2"
                >
                    <FormField label="Reason for Refund" required>
                        <textarea
                            className="form-textarea"
                            required
                            rows={3}
                            placeholder="e.g. Partner store was unable to process voucher at POS..."
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                        />
                    </FormField>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
