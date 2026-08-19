import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { StatusBadge } from '../../components/Admin/FormPrimitives';
import { showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';

export default function CouponDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [coupon, setCoupon] = useState<any | null>(null);
    const [usages, setUsages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const [couponData, usagesData] = await Promise.all([adminApi.getCoupon(id), adminApi.getCouponUsages(id)]);
            setCoupon(couponData);
            setUsages(usagesData);
            dispatch(setPageTitle((couponData as any).code || 'Coupon Detail'));
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

    const infoCards = useMemo(() => {
        if (!coupon) return [];
        return [
            { label: 'Discount', value: coupon.discountType === 'FLAT' ? `₹${coupon.discountValue}` : `${coupon.discountValue}%` },
            { label: 'Min Order Value', value: `₹${coupon.minOrderValue}` },
            { label: 'Usage', value: `${coupon.usedCount} / ${coupon.usageLimit ?? '∞'}` },
            { label: 'Per-User Limit', value: coupon.perUserLimit },
            { label: 'Applicable To', value: coupon.applicableTo },
            { label: 'Expires', value: coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : 'Never' },
            { label: 'Status', value: coupon.isActive ? 'ACTIVE' : 'INACTIVE' },
        ];
    }, [coupon]);

    if (loading) {
        return <div className="panel">Loading coupon...</div>;
    }

    if (!coupon) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'Coupon not found'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/admin/coupons')}>
                    Back to coupons
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-start gap-3">
                    <Link to="/admin/coupons" className="btn btn-outline-primary p-2 mt-0.5" aria-label="Back">
                        <IconArrowLeft className="w-4.5 h-4.5" />
                    </Link>
                    <div>
                        <h2 className="text-xl font-semibold dark:text-white-light">{coupon.code}</h2>
                        <p className="text-white-dark text-sm mt-1">{coupon.description || 'Coupon detail and redemption history'}</p>
                    </div>
                </div>
                <StatusBadge status={coupon.isActive ? 'ACTIVE' : 'INACTIVE'} />
            </div>

            <div className="panel mb-5">
                <h5 className="font-semibold text-lg mb-4">Coupon information</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {infoCards.map((card) => (
                        <div key={card.label} className="rounded border border-[#ebedf2] dark:border-[#191e3a] p-4">
                            <div className="text-xs uppercase tracking-wide text-white-dark mb-1">{card.label}</div>
                            <div className="font-semibold break-all">{card.label === 'Status' ? <StatusBadge status={String(card.value)} /> : card.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="panel">
                <h5 className="font-semibold text-lg mb-4">Redemption History ({usages.length})</h5>
                {usages.length === 0 ? (
                    <p className="text-sm text-white-dark italic">Not used by any customer yet</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table-striped text-sm">
                            <thead>
                                <tr>
                                    <th>Customer</th>
                                    <th>Discount</th>
                                    <th>Order</th>
                                    <th>Used At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usages.map((usage) => (
                                    <tr key={usage.id}>
                                        <td>{usage.user?.fullName ?? usage.user?.email ?? 'Unknown user'}</td>
                                        <td>₹{usage.discount}</td>
                                        <td>
                                            {usage.orderId ? (
                                                <button type="button" className="text-primary hover:underline" onClick={() => navigate(`/admin/orders/${usage.orderId}`)}>
                                                    View order
                                                </button>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td>{new Date(usage.usedAt).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
