import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { setPageTitle } from '../../store/themeConfigSlice';
import IconShoppingCart from '../../components/Icon/IconShoppingCart';
import IconDollarSign from '../../components/Icon/IconDollarSign';
import IconDollarSignCircle from '../../components/Icon/IconDollarSignCircle';
import IconBox from '../../components/Icon/IconBox';
import IconCashBanknotes from '../../components/Icon/IconCashBanknotes';
import IconClipboardText from '../../components/Icon/IconClipboardText';

const ReactApexChart = lazy(() => import('react-apexcharts'));

type Overview = {
    summary: {
        ordersThisMonth: number | null;
        grossSalesThisMonth: number | null;
        platformCommissionThisMonth: number | null;
        sellerPayoutsThisMonth: number | null;
        grossSalesChange: number | null;
        awaitingFulfillment: number | null;
        productsAwaitingApproval: number | null;
        activeProducts: number | null;
        activeSellers: number | null;
    };
    visibility: {
        orders: boolean;
        products: boolean;
        sellers: boolean;
        canCreateSale: boolean;
        canReviewProducts: boolean;
    };
    salesTrend: Array<{ date: string; orders: number; revenue: number }>;
    recentOrders: any[];
};

const money = (value: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
}).format(value);

const shortDate = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const Dashboard = () => {
    const dispatch = useDispatch();
    const [overview, setOverview] = useState<Overview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const loadOverview = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.getDashboardOverview();
            setOverview(data);
        } catch (err) {
            setError(getErrorMessage(err, 'Dashboard data could not be loaded'));
        } finally {
            setLoading(false);
        }
    }, []);
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    }, []);

    useEffect(() => {
        dispatch(setPageTitle('Dashboard'));
        void loadOverview();
    }, [dispatch, loadOverview]);

    const summary = overview?.summary;
    const recentOrders = Array.isArray(overview?.recentOrders) ? overview.recentOrders : [];
    const hasSalesActivity = (overview?.salesTrend ?? []).some((point) => point.revenue > 0);
    const series = [
        { name: 'Gross sales', data: (overview?.salesTrend ?? []).map((point) => point.revenue) },
    ];
    const chartOptions: ApexCharts.ApexOptions = {
        chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Inter, sans-serif', animations: { speed: 350 } },
        colors: ['#2563eb'],
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2.5 },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.2, opacityTo: 0.015, stops: [0, 90, 100] } },
        grid: { borderColor: '#e7ede9', strokeDashArray: 4, padding: { left: 6, right: 12 } },
        xaxis: { categories: (overview?.salesTrend ?? []).map((point) => shortDate(point.date)), axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#78877f', fontSize: '11px' } } },
        yaxis: { labels: { formatter: (value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`, style: { colors: '#78877f', fontSize: '11px' } } },
        tooltip: { y: { formatter: (value) => money(value) } },
        noData: { text: loading ? 'Loading sales activity…' : 'No paid orders in the last 7 days', style: { color: '#78877f', fontSize: '13px' } },
    };

    const stats = [
        { scope: 'orders', label: 'Gross sales this month', value: summary?.grossSalesThisMonth == null ? '—' : money(summary.grossSalesThisMonth), note: summary?.grossSalesChange == null ? 'Paid orders this month' : `${summary.grossSalesChange >= 0 ? '+' : ''}${summary.grossSalesChange}% vs last month`, icon: <IconDollarSign className="h-5 w-5" />, tone: 'mint' },
        { scope: 'orders', label: 'Platform commission', value: summary?.platformCommissionThisMonth == null ? '—' : money(summary.platformCommissionThisMonth), note: 'Earned from paid orders this month', icon: <IconDollarSignCircle className="h-5 w-5" />, tone: 'sky' },
        { scope: 'orders', label: 'Seller payouts', value: summary?.sellerPayoutsThisMonth == null ? '—' : money(summary.sellerPayoutsThisMonth), note: 'Order payout snapshots on paid sales', icon: <IconCashBanknotes className="h-5 w-5" />, tone: 'rose' },
        { scope: 'orders', label: 'Orders this month', value: summary?.ordersThisMonth ?? '—', note: 'Excluding cancelled and returned', icon: <IconShoppingCart className="h-5 w-5" />, tone: 'sky' },
        { scope: 'orders', label: 'Awaiting fulfillment', value: summary?.awaitingFulfillment ?? '—', note: 'Payment cleared or COD eligible', icon: <IconClipboardText className="h-5 w-5" />, tone: 'amber' },
        { scope: 'products', label: 'Products to review', value: summary?.productsAwaitingApproval ?? '—', note: `${summary?.activeProducts ?? '—'} active listings`, icon: <IconBox className="h-5 w-5" />, tone: 'rose' },
    ];
    const visibleStats = overview
        ? stats.filter((stat) => overview.visibility[stat.scope as 'orders' | 'products'])
        : loading ? stats : [];
    const canViewOrders = overview?.visibility.orders ?? false;
    const canViewProducts = overview?.visibility.products ?? false;
    const canViewSellers = overview?.visibility.sellers ?? false;

    return (
        <main className="commerce-dashboard">
            <header className="dashboard-heading">
                <div>
                    <p className="dashboard-eyebrow">UNIQUE NGO · COMMERCE</p>
                    <h1>{greeting}, welcome back</h1>
                    <p className="dashboard-subtitle">A clear view of sales, fulfillment, and catalog activity.</p>
                </div>
                <div className="dashboard-heading-actions">
                    {overview?.visibility.canReviewProducts ? <Link to="/admin/products" className="btn btn-outline-dark">Review catalog</Link> : null}
                    {overview?.visibility.canCreateSale ? <Link to="/admin/orders?action=create" className="btn btn-primary">Record a sale</Link> : null}
                </div>
            </header>

            {error ? (
                <div className="dashboard-alert" role="alert">
                    <span>{error}</span>
                    <button type="button" className="dashboard-alert-retry" onClick={() => void loadOverview()} disabled={loading}>
                        {loading ? 'Retrying…' : 'Retry'}
                    </button>
                </div>
            ) : null}

            <section className="dashboard-stats" aria-label="Commerce summary">
                {visibleStats.map((stat) => (
                    <article className="dashboard-stat" key={stat.label}>
                        <div className={`dashboard-stat-icon ${stat.tone}`}>{stat.icon}</div>
                        <p>{stat.label}</p>
                        <strong>{loading ? <span className="dashboard-skeleton" /> : stat.value}</strong>
                        <span>{stat.note}</span>
                    </article>
                ))}
            </section>

            {canViewOrders || canViewProducts || canViewSellers ? <section className={`dashboard-main-grid ${!canViewOrders || !(canViewProducts || canViewSellers) ? 'dashboard-main-grid-single' : ''}`}>
                {canViewOrders ? <article className="dashboard-surface dashboard-trend">
                    <div className="dashboard-section-heading">
                        <div>
                            <h2>Sales activity</h2>
                            <p>Paid order value over the last seven days</p>
                        </div>
                    </div>
                    {loading ? (
                        <div className="dashboard-chart-loading" role="status">Loading sales activity</div>
                    ) : hasSalesActivity ? (
                        <Suspense fallback={<div className="dashboard-chart-loading" role="status">Loading chart</div>}>
                            <ReactApexChart type="area" height={270} options={chartOptions} series={series} />
                        </Suspense>
                    ) : (
                        <div className="dashboard-chart-empty" role="status">
                            <span>No paid sales in the last 7 days</span>
                            <p>Sales activity will appear here when an order is paid.</p>
                        </div>
                    )}
                </article> : null}

                {canViewOrders || canViewProducts || canViewSellers ? <aside className="dashboard-surface dashboard-operations">
                    <div className="dashboard-section-heading">
                        <div><h2>Needs attention</h2><p>Keep the marketplace moving</p></div>
                    </div>
                    {canViewProducts ? <Link to="/admin/products?status=PENDING_REVIEW" className="dashboard-task">
                        <span className="dashboard-task-dot warm" />
                        <span><strong>Product approvals</strong><small>Review seller submissions</small></span>
                        <b>{summary?.productsAwaitingApproval ?? '—'}</b>
                    </Link> : null}
                    {canViewOrders ? <Link to="/admin/orders?status=PROCESSING" className="dashboard-task">
                        <span className="dashboard-task-dot green" />
                        <span><strong>Order fulfillment</strong><small>Ready for the next step</small></span>
                        <b>{summary?.awaitingFulfillment ?? '—'}</b>
                    </Link> : null}
                    {canViewSellers ? <div className="dashboard-seller-note">
                        <span className="dashboard-seller-mark">S</span>
                        <span><strong>{summary?.activeSellers ?? '—'} active sellers</strong><small>Contributing to the marketplace</small></span>
                        <Link to="/admin/sellers" aria-label="View sellers">View</Link>
                    </div> : null}
                </aside> : null}
            </section> : null}

            {canViewOrders ? <section className="dashboard-surface dashboard-recent">
                <div className="dashboard-section-heading">
                    <div><h2>Recent orders</h2><p>Latest customer and counter sales</p></div>
                    <Link to="/admin/orders" className="dashboard-text-link">All orders <span aria-hidden="true">→</span></Link>
                </div>
                {loading ? (
                    <div className="dashboard-loading-rows"><i /><i /><i /></div>
                ) : recentOrders.length ? (
                    <div className="dashboard-table-wrap">
                        <table className="dashboard-orders-table">
                            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Payment</th><th>Status</th><th className="align-right">Total</th></tr></thead>
                            <tbody>
                                {recentOrders.map((order) => (
                                    <tr key={order.id}>
                                        <td><Link to={`/admin/orders/${order.id}`} className="dashboard-order-id">{order.orderNumber}</Link></td>
                                        <td>{order.buyer?.fullName ?? 'Counter customer'}</td>
                                        <td>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                                        <td><span className={`dashboard-payment ${order.paymentStatus === 'SUCCESS' ? 'paid' : 'pending'}`}>{order.paymentStatus === 'SUCCESS' ? 'Paid' : order.paymentStatus}</span></td>
                                        <td><span className={`dashboard-order-status ${String(order.status).toLowerCase()}`}>{String(order.status).replaceAll('_', ' ')}</span></td>
                                        <td className="align-right font-semibold">{money(order.totalAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="dashboard-empty"><span>Nothing to review yet</span><p>New online and counter orders will appear here.</p></div>
                )}
            </section> : null}
        </main>
    );
};

export default Dashboard;
