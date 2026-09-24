import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { setPageTitle } from '../../store/themeConfigSlice';
import Icon from '../../components/Admin/WorkspaceIcon';
import { StatusBadge } from '../../components/Admin/FormPrimitives';

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
    const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue');
    const [days, setDays] = useState(7);
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
    useEffect(() => {
        dispatch(setPageTitle('Dashboard'));
        void loadOverview();
    }, [dispatch, loadOverview]);

    const summary = overview?.summary;
    const recentOrders = Array.isArray(overview?.recentOrders) ? overview.recentOrders : [];
    const hasSalesActivity = (overview?.salesTrend ?? []).some((point) => point.revenue > 0);
    const trend = (overview?.salesTrend ?? []).slice(-days);
    const series = [
        { name: metric === 'revenue' ? 'Gross sales' : 'Orders', data: trend.map((point) => point[metric]) },
    ];
    const chartOptions: ApexCharts.ApexOptions = {
        chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Arial, sans-serif', animations: { speed: 350 } },
        colors: ['#2563eb'],
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2.5 },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.2, opacityTo: 0.015, stops: [0, 90, 100] } },
        grid: { borderColor: '#e7ede9', strokeDashArray: 4, padding: { left: 6, right: 12 } },
        xaxis: { categories: trend.map((point) => shortDate(point.date)), axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#78877f', fontSize: '11px' } } },
        yaxis: { labels: { formatter: (value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`, style: { colors: '#78877f', fontSize: '11px' } } },
        tooltip: { y: { formatter: (value) => metric === 'revenue' ? money(value) : `${value} orders` } },
        noData: { text: loading ? 'Loading sales activity…' : 'No paid orders in the last 7 days', style: { color: '#78877f', fontSize: '13px' } },
    };

    const stats = [
        { label: 'Gross sales', value: summary?.grossSalesThisMonth == null ? '—' : money(summary.grossSalesThisMonth), note: summary?.grossSalesChange == null ? 'From paid orders' : `${summary.grossSalesChange >= 0 ? '+' : ''}${summary.grossSalesChange}% vs previous month` },
        { label: 'Orders placed', value: summary?.ordersThisMonth ?? '—', note: 'Excludes cancelled & returned' },
        { label: 'Platform earnings', value: summary?.platformCommissionThisMonth == null ? '—' : money(summary.platformCommissionThisMonth), note: 'Commission earned this month' },
        { label: 'Seller payouts', value: summary?.sellerPayoutsThisMonth == null ? '—' : money(summary.sellerPayoutsThisMonth), note: 'Supporting your seller network' },
    ];
    const canViewOrders = overview?.visibility.orders ?? false;
    const canViewProducts = overview?.visibility.products ?? false;
    const canViewSellers = overview?.visibility.sellers ?? false;
    const attention = (summary?.awaitingFulfillment || 0) + (summary?.productsAwaitingApproval || 0);
    return <div className="ws-overview">
        <div className="ws-page-heading"><div><p className="ws-eyebrow">THE BIG PICTURE</p><h1>Everyday actions. Lasting impact.</h1><p>Your operations at a glance. Here’s where you can make a difference today.</p></div><div className="ws-heading-actions"><span className="ws-date"><Icon name="calendar"/>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>{overview?.visibility.canCreateSale && <Link className="btn btn-primary" to="/admin/orders?action=create"><Icon name="plus"/>Record a sale</Link>}</div></div>
        <div className="ws-overview-tabs"><span className="is-active">Overview</span><span className="ws-period">Month to date <span>·</span> {new Date().toLocaleDateString('en-IN', {month: 'long', year: 'numeric'})}</span></div>
        {error && <div className="ws-error" role="alert"><div><strong>We couldn’t load your overview</strong><p>{error}</p></div><button className="btn btn-outline-dark" disabled={loading} onClick={() => void loadOverview()}>Try again</button></div>}
        {(loading || canViewOrders) && <section className="ws-metrics" aria-label="Monthly performance">{stats.map((s, i) => <article key={s.label}><span className="ws-metric-label">{s.label}<span>0{i+1}</span></span><strong>{loading ? <i className="ws-skeleton"/> : s.value}</strong><small>{s.note}</small></article>)}</section>}
        {loading ? <div className="ws-page-skeleton" role="status" aria-label="Loading operations"><i/><i/></div> : <>
        <div className="ws-overview-grid">
          {canViewOrders && <section className="ws-trend"><div className="ws-section-heading"><div><p className="ws-eyebrow">PERFORMANCE</p><h2>Marketplace activity</h2></div><select aria-label="Chart period" value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={3}>Last 3 days</option></select></div><div className="ws-chart-toolbar"><div className="ws-segment"><button aria-pressed={metric === 'revenue'} onClick={() => setMetric('revenue')}>Sales revenue</button><button aria-pressed={metric === 'orders'} onClick={() => setMetric('orders')}>Orders</button></div><span><i/> {metric === 'revenue' ? 'Paid order value' : 'Order count'}</span></div><Suspense fallback={<div className="ws-chart-placeholder"/>}><ReactApexChart type="area" height={250} options={chartOptions} series={series}/></Suspense>{!hasSalesActivity && <p className="ws-chart-note">Paid sales will appear here as your marketplace grows.</p>}</section>}
          <aside className="ws-attention"><div className="ws-section-heading"><div><p className="ws-eyebrow">YOUR NEXT STEPS</p><h2>Needs attention</h2></div><span className="ws-count">{attention}</span></div><p className="ws-muted">A little action goes a long way.</p>
            {canViewProducts && <Link className="ws-task" to="/admin/products?status=PENDING_REVIEW"><span className="ws-task-icon"><Icon name="tag"/></span><span><strong>Review product submissions</strong><small>{summary?.productsAwaitingApproval || 0} products waiting for approval</small></span><Icon name="arrow"/></Link>}
            {canViewOrders && <Link className="ws-task" to="/admin/orders?status=PROCESSING"><span className="ws-task-icon"><Icon name="box"/></span><span><strong>Move orders forward</strong><small>{summary?.awaitingFulfillment || 0} orders awaiting fulfillment</small></span><Icon name="arrow"/></Link>}
            {canViewSellers && <Link className="ws-network" to="/admin/sellers"><span className="ws-network-avatars"><b>S</b><b>U</b><b>+</b></span><strong>{summary?.activeSellers || 0} active sellers<small>One connected community</small></strong><Icon name="arrow"/></Link>}
            {!canViewOrders && !canViewProducts && !canViewSellers && <p className="ws-search-note">Use the navigation to open the workflows available to your role.</p>}
          </aside>
        </div>
        {canViewOrders && <section className="ws-recent"><div className="ws-section-heading"><div><p className="ws-eyebrow">LATEST MOVEMENT</p><h2>Recent orders</h2></div><Link to="/admin/orders" className="ws-text-link">View all orders <Icon name="arrow"/></Link></div>{recentOrders.length ? <div className="ws-table-scroll"><table><thead><tr><th>Order reference</th><th>Customer</th><th>Date</th><th>Payment</th><th>Fulfillment</th><th className="ws-number">Amount</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{recentOrders.map(order => <tr key={order.id}><td><Link className="ws-record-link" to={`/admin/orders/${order.id}`}>{order.orderNumber}</Link></td><td><div className="ws-person"><span className="ws-avatar">{(order.buyer?.fullName || 'C').slice(0,1)}</span>{order.buyer?.fullName || 'Counter customer'}</div></td><td>{shortDate(order.createdAt)}</td><td><StatusBadge status={order.paymentStatus === 'SUCCESS' ? 'SUCCESS' : order.paymentStatus}/></td><td><StatusBadge status={order.status}/></td><td className="ws-number">{money(order.totalAmount)}</td><td><Link className="ws-icon-button" aria-label={`View order ${order.orderNumber}`} to={`/admin/orders/${order.id}`}><Icon name="arrow"/></Link></td></tr>)}</tbody></table></div> : <div className="ws-empty"><Icon name="box"/><h3>Your next chapter starts with an order</h3><p>Online and counter sales will appear here. Open orders to get started.</p><Link className="btn btn-outline-dark" to="/admin/orders">Go to orders <Icon name="arrow"/></Link></div>}</section>}
        </>}
    </div>;
};
export default Dashboard;
