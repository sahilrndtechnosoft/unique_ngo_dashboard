import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import {
    DetailFacts,
    FormField,
    FormSection,
    StatusBadge,
} from '../../components/Admin/FormPrimitives';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';
import IconCopy from '../../components/Icon/IconCopy';
import IconLink from '../../components/Icon/IconLink';

export default function RedemptionDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [redemption, setRedemption] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isRefunding, setIsRefunding] = useState(false);
    const [refundReason, setRefundReason] = useState('');
    const [busy, setBusy] = useState(false);

    const load = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.getRedemption(id);
            setRedemption(data);
            dispatch(setPageTitle(`Redemption ${id.slice(0, 8)}... - Details`));
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleCopy = (text: string, label = 'Copied') => {
        navigator.clipboard.writeText(text);
        showAlert(`${label} copied to clipboard!`);
    };

    const handleRefundSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!id || !refundReason.trim()) return;
        setBusy(true);
        try {
            await adminApi.refundRedemption(id, refundReason.trim());
            showAlert('Redemption successfully refunded and points restored to user');
            setIsRefunding(false);
            setRefundReason('');
            await load();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const facts = useMemo(() => {
        if (!redemption) return [];
        return [
            { label: 'Redemption ID', value: <code className="font-mono text-xs">{redemption.id}</code> },
            { label: 'Points Deducted', value: <span className="font-bold text-primary">{redemption.pointsUsed} pts</span> },
            { label: 'Monetary Equivalent', value: `₹${redemption.monetaryValue}` },
            { label: 'Status', value: <StatusBadge status={redemption.status} /> },
            { label: 'Created At', value: redemption.createdAt ? new Date(redemption.createdAt).toLocaleString() : '—' },
            { label: 'Last Updated', value: redemption.updatedAt ? new Date(redemption.updatedAt).toLocaleString() : '—' },
            {
                label: 'Idempotency Key',
                value: redemption.idempotencyKey ? (
                    <code className="font-mono text-xs">{redemption.idempotencyKey}</code>
                ) : (
                    '—'
                ),
            },
        ];
    }, [redemption]);

    if (loading) {
        return <div className="panel">Loading redemption details...</div>;
    }

    if (!redemption) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'Redemption record not found'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/admin/redemptions')}>
                    Back to Redemptions
                </button>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <Link to="/admin/redemptions" className="btn btn-outline-primary p-2" aria-label="Back">
                        <IconArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold dark:text-white-light">Redemption Details</h2>
                            <StatusBadge status={redemption.status} />
                        </div>
                        <div className="flex items-center gap-2 text-white-dark text-xs mt-1">
                            <span className="font-mono">{redemption.id}</span>
                            <button
                                type="button"
                                className="hover:text-primary"
                                onClick={() => handleCopy(redemption.id, 'Redemption ID')}
                                title="Copy ID"
                            >
                                <IconCopy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {redemption.status === 'COMPLETED' ? (
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => {
                                setRefundReason('');
                                setIsRefunding(true);
                            }}
                        >
                            Refund & Restore Points
                        </button>
                    ) : null}
                </div>
            </div>

            {/* Failure Reason Alert */}
            {redemption.failureReason ? (
                <div className="mb-6 rounded-lg bg-danger-light p-4 text-danger border border-danger/20">
                    <div className="font-bold mb-1">Redemption Failure Detail</div>
                    <div className="text-sm font-mono">{redemption.failureReason}</div>
                </div>
            ) : null}

            {/* Financial & General Facts */}
            <div className="panel mb-6">
                <h5 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white-light">Redemption Information</h5>
                <DetailFacts items={facts} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* User Info Card */}
                <div className="panel">
                    <div className="flex items-center justify-between mb-4">
                        <h5 className="font-semibold text-lg text-gray-900 dark:text-white-light">Member Account</h5>
                        {redemption.user?.id ? (
                            <Link
                                to={`/admin/users/${redemption.user.id}`}
                                className="text-primary hover:underline flex items-center gap-1 text-sm font-semibold"
                            >
                                View User Profile <IconLink className="w-3.5 h-3.5" />
                            </Link>
                        ) : null}
                    </div>

                    {redemption.user ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary-light text-primary font-bold flex items-center justify-center text-lg">
                                    {redemption.user.name?.charAt(0) || 'U'}
                                </div>
                                <div>
                                    <div className="font-semibold text-base text-gray-900 dark:text-white-light">
                                        {redemption.user.name}
                                    </div>
                                    <div className="text-xs text-white-dark">{redemption.user.email}</div>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-sm grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-xs text-white-dark block">Mobile Number</span>
                                    <span className="font-medium">{redemption.user.mobile || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-white-dark block">Account Status</span>
                                    <StatusBadge status={redemption.user.status || 'ACTIVE'} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-white-dark text-sm">User record: {redemption.userId}</div>
                    )}
                </div>

                {/* Catalog Item Card */}
                <div className="panel">
                    <div className="flex items-center justify-between mb-4">
                        <h5 className="font-semibold text-lg text-gray-900 dark:text-white-light">Redeemed Reward Item</h5>
                        {redemption.catalogItem?.id ? (
                            <Link
                                to={`/admin/rewards-catalog/${redemption.catalogItem.id}`}
                                className="text-primary hover:underline flex items-center gap-1 text-sm font-semibold"
                            >
                                View Catalog Item <IconLink className="w-3.5 h-3.5" />
                            </Link>
                        ) : null}
                    </div>

                    {redemption.catalogItem ? (
                        <div className="flex items-start gap-3">
                            {redemption.catalogItem.imageUrl ? (
                                <img
                                    src={redemption.catalogItem.imageUrl}
                                    alt={redemption.catalogItem.title}
                                    className="h-12 w-12 rounded object-cover shadow-sm border border-gray-200 dark:border-gray-700"
                                />
                            ) : (
                                <div className="h-12 w-12 rounded bg-primary-light text-primary font-bold flex items-center justify-center text-xl">
                                    🎁
                                </div>
                            )}
                            <div className="flex-1">
                                <div className="font-bold text-base text-gray-900 dark:text-white-light">
                                    {redemption.catalogItem.title}
                                </div>
                                <div className="text-xs text-white-dark mt-0.5">
                                    Category: {redemption.catalogItem.category} • Cost:{' '}
                                    <span className="text-primary font-semibold">
                                        {redemption.catalogItem.pointsCost} pts
                                    </span>{' '}
                                    • Value: ₹{redemption.catalogItem.monetaryValue}
                                </div>
                                {redemption.catalogItem.description ? (
                                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                                        {redemption.catalogItem.description}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <div className="text-white-dark text-sm">Catalog Item: {redemption.catalogItemId || '—'}</div>
                    )}
                </div>
            </div>

            {/* Issued Voucher Card */}
            {redemption.voucher ? (
                <div className="panel mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h5 className="font-semibold text-lg text-gray-900 dark:text-white-light">Issued Partner Voucher</h5>
                        <StatusBadge status={redemption.voucher.status} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <div className="text-xs font-semibold text-white-dark uppercase tracking-wider mb-1">
                                Voucher Code
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xl font-bold text-primary tracking-wider">
                                    {redemption.voucher.code}
                                </span>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary p-1.5"
                                    onClick={() => handleCopy(redemption.voucher.code, 'Voucher code')}
                                    title="Copy Code"
                                >
                                    <IconCopy className="w-4 h-4" />
                                </button>
                            </div>
                            {redemption.voucher.securityPin ? (
                                <div className="text-xs text-white-dark mt-2 font-mono">
                                    Security PIN: <span className="font-bold text-gray-800 dark:text-gray-200">{redemption.voucher.securityPin}</span>
                                </div>
                            ) : null}
                        </div>

                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <div className="text-xs font-semibold text-white-dark uppercase tracking-wider mb-1">
                                Partner Store
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white-light">
                                {redemption.partnerStore?.name || 'Direct Platform Reward'}
                            </div>
                            {redemption.partnerStore?.slug ? (
                                <div className="text-xs text-white-dark font-mono mt-0.5">
                                    Slug: {redemption.partnerStore.slug}
                                </div>
                            ) : null}
                            {redemption.voucher.redeemedStoreLocation ? (
                                <div className="text-xs text-primary font-medium mt-1">
                                    Redeemed at: {redemption.voucher.redeemedStoreLocation}
                                </div>
                            ) : null}
                        </div>

                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <div className="text-xs font-semibold text-white-dark uppercase tracking-wider mb-1">
                                Validity & Expiry
                            </div>
                            <div className="text-sm font-medium">
                                Expires: {redemption.voucher.expiresAt ? new Date(redemption.voucher.expiresAt).toLocaleDateString() : 'Never'}
                            </div>
                            {redemption.voucher.redeemedAt ? (
                                <div className="text-xs text-success font-medium mt-1">
                                    Redeemed on {new Date(redemption.voucher.redeemedAt).toLocaleString()}
                                </div>
                            ) : (
                                <div className="text-xs text-white-dark mt-1">Not yet redeemed at POS</div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Audit Logs / Activity History */}
            {redemption.auditLogs && redemption.auditLogs.length > 0 ? (
                <div className="panel">
                    <h5 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white-light">
                        State Audit Trail ({redemption.auditLogs.length})
                    </h5>
                    <div className="space-y-4">
                        {redemption.auditLogs.map((log: any) => (
                            <div
                                key={log.id}
                                className="flex items-start gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                            >
                                <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <div className="font-bold text-sm text-gray-900 dark:text-white-light">
                                            {log.eventType?.replace(/_/g, ' ')}
                                        </div>
                                        <div className="text-xs text-white-dark">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-xs text-white-dark mt-0.5">
                                        Actor: <span className="font-mono">{log.actorType}</span> ({log.actorId || 'SYSTEM'}) • Entity: {log.entityType}
                                    </div>
                                    {log.metadata && Object.keys(log.metadata).length > 0 ? (
                                        <pre className="mt-2 p-2 rounded bg-white dark:bg-black/40 text-[11px] font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                                            {JSON.stringify(log.metadata, null, 2)}
                                        </pre>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* Refund Modal */}
            <AdminFormModal
                open={isRefunding}
                title="Refund Redemption & Restore Points"
                onClose={() => setIsRefunding(false)}
                onSubmit={handleRefundSubmit}
                busy={busy}
                size="md"
            >
                <FormSection
                    title="Confirm Points Refund"
                    description={`This will refund ${redemption.pointsUsed} points back to ${redemption.user?.name || 'the user'}, restore catalog item stock, and cancel the issued voucher.`}
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
