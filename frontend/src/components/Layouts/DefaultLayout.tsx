import { PropsWithChildren, Suspense, useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState } from '../../store';
import { clearAuth } from '../../store/authSlice';
import { useAppBranding } from '../../hooks/useAppBranding';
import { adminMenuGroups, canAccess } from '../../config/admin-menu';
import { adminApi } from '../../services/admin.service';
import { mediaUrl } from '../../services/api';
import { logout } from '../../services/auth.service';
import Icon from '../Admin/WorkspaceIcon';
import '../../assets/css/workspace.css';

const icons: Record<string, string> = { '/': 'overview', users: 'users', sellers: 'users', orders: 'box', products: 'tag', categories: 'overview', coupons: 'tag', hospitals: 'hospital', campaigns: 'flag', appointments: 'calendar', 'blood-donations': 'drop', 'blood-requests': 'heart', 'donation-items': 'heart', inquiries: 'message', suggestions: 'message', notifications: 'bell' };
const iconFor = (path: string) => icons[path.split('/').pop() || '/'] || 'box';
type Result = { label: string; to: string; kind: string };

export default function DefaultLayout({ children }: PropsWithChildren) {
 const branding = useAppBranding();
 const auth = useSelector((s: IRootState) => s.auth);
 const dispatch = useDispatch();
 const location = useLocation();
 const navigate = useNavigate();
 const [collapsed, setCollapsed] = useState(() => localStorage.getItem('workspace-rail') === 'true');
 const [mobile, setMobile] = useState(false);
 const [palette, setPalette] = useState(false);
 const [help, setHelp] = useState(false);
 const [query, setQuery] = useState('');
 const [records, setRecords] = useState<Result[]>([]);
 const [searching, setSearching] = useState(false);
 const [searchError, setSearchError] = useState(false);
 const groups = adminMenuGroups.map(g => ({ ...g, items: g.items.filter(i => canAccess(auth.isSuperAdmin, auth.permissions, i.permission)) })).filter(g => g.items.length);
 const pages = groups.flatMap(g => g.items);
 const current = pages.find(i => i.to === location.pathname || (i.to !== '/' && location.pathname.startsWith(i.to + '/')));
 const group = groups.find(g => g.items.includes(current!));
 const can = (p: `${string}:${string}`) => canAccess(auth.isSuperAdmin, auth.permissions, p);
 useEffect(() => { setMobile(false); setPalette(false); }, [location.pathname, location.search]);
 useEffect(() => {
  const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p); } };
  window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
 }, []);
 useEffect(() => {
  if (!palette || query.trim().length < 2) { setRecords([]); setSearching(false); return; }
  let cancelled = false;
  setSearching(true); setSearchError(false); setRecords([]);
  const timer = window.setTimeout(async () => {
   const sources = [
    { permission: 'USERS:VIEW' as const, fetch: adminApi.listUsers, path: 'users', kind: 'Member', title: (r: any) => r.fullName || r.email },
    { permission: 'PRODUCTS:VIEW' as const, fetch: adminApi.listProducts, path: 'products', kind: 'Product', title: (r: any) => r.name },
    { permission: 'ORDERS:VIEW' as const, fetch: adminApi.listOrders, path: 'orders', kind: 'Order', title: (r: any) => r.orderNumber },
    { permission: 'BLOOD_BANK:VIEW' as const, fetch: adminApi.listCampaigns, path: 'campaigns', kind: 'Campaign', title: (r: any) => r.title || r.name },
   ].filter(s => can(s.permission));
   const results = await Promise.allSettled(sources.map(async s => {
    const data = await s.fetch({ search: query.trim(), limit: 5, page: 1 });
    return (data.items || []).map((r: any) => ({ label: s.title(r) || r.id, to: `/admin/${s.path}/${r.id}`, kind: s.kind }));
   }));
   if (!cancelled) { setRecords(results.flatMap(r => r.status === 'fulfilled' ? r.value : [])); setSearchError(results.some(r => r.status === 'rejected')); setSearching(false); }
  }, 300);
  return () => { cancelled = true; clearTimeout(timer); };
 }, [palette, query, auth.isSuperAdmin, auth.permissions]);
 const navigation = <>
  <Link to="/" className="ws-brand"><img className="ws-brand-logo" src={branding.logoUrl ? mediaUrl(branding.logoUrl) : '/assets/images/logo.svg'} alt={branding.companyName || 'Unique NGO'}/><span className="ws-nav-label"><strong>{branding.companyName || 'Unique NGO'}</strong><small>Operations workspace</small></span></Link>
  <button className="ws-nav-search" onClick={() => { setMobile(false); setPalette(true); }} title="Search workspace"><Icon name="search"/><span className="ws-nav-label">Find anything</span><kbd className="ws-nav-label">⌘ K</kbd></button>
  <nav aria-label="Main navigation" className="ws-nav">
   {groups.map(g => <div className="ws-nav-group" key={g.label || 'home'}>
    {g.label && <p className="ws-nav-label">{g.label}</p>}
    {g.items.map(i => <NavLink key={i.to} end={i.to === '/'} to={i.to} title={i.label} className={({isActive}) => `ws-nav-item ${isActive ? 'is-active' : ''}`}><Icon name={iconFor(i.to)}/><span className="ws-nav-label">{i.label}</span>{i.to === '/' && <span className="ws-nav-label ws-home-dot"/>}</NavLink>)}
   </div>)}
  </nav>
  <div className="ws-sidebar-bottom">
   <button className="ws-nav-item" onClick={() => {setMobile(false); setHelp(true);}} title="Workspace guide"><Icon name="help"/><span className="ws-nav-label">Workspace guide</span></button>
   <Link className="ws-account" to="/users/profile" title="Your profile"><span className="ws-avatar">{auth.user?.fullName?.slice(0, 1) || 'A'}</span><span className="ws-nav-label"><strong>{auth.user?.fullName || 'Administrator'}</strong><small>{auth.isSuperAdmin ? 'Super administrator' : 'Administrator'}</small></span><Icon name="chevron"/></Link>
  </div>
 </>;
 return <div className={`ws-app ${collapsed ? 'ws-collapsed' : ''}`}>
  <a href="#workspace-content" className="ws-skip">Skip to content</a>
  <aside className="ws-sidebar">{navigation}</aside>
  <Dialog open={mobile} onClose={setMobile} className="ws-overlay ws-mobile-dialog"><div className="ws-backdrop"/><DialogPanel className="ws-mobile-nav"><DialogTitle className="sr-only">Navigation</DialogTitle><button className="ws-icon-button ws-mobile-close" aria-label="Close navigation" onClick={() => setMobile(false)}><Icon name="close"/></button>{navigation}</DialogPanel></Dialog>
  <div className="ws-main">
   <header className="ws-topbar">
    <button className="ws-icon-button ws-desktop-toggle" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => { setCollapsed(!collapsed); localStorage.setItem('workspace-rail', String(!collapsed)); }}><Icon name="panel"/></button>
    <button className="ws-icon-button ws-mobile-toggle" aria-label="Open navigation" onClick={() => setMobile(true)}><Icon name="panel"/></button>
    <div className="ws-breadcrumb"><span>{group?.label || 'Workspace'}</span><Icon name="chevron"/><strong>{current?.label || 'Account'}</strong>{location.pathname.split('/').length > 3 && <><Icon name="chevron"/><span>Details</span></>}</div>
    <div className="ws-top-actions"><button className="ws-icon-button" onClick={() => setPalette(true)} aria-label="Global search"><Icon name="search"/></button><button className="ws-icon-button" onClick={() => setHelp(true)} aria-label="Help"><Icon name="help"/></button><span className="ws-top-divider"/><details className="ws-profile"><summary aria-label="Account menu"><span className="ws-avatar">{auth.user?.fullName?.slice(0, 1) || 'A'}</span></summary><div className="ws-popover"><strong>{auth.user?.fullName || 'Administrator'}</strong><Link to="/users/profile">Account & profile</Link><button onClick={async () => { try { if(auth.refreshToken) await logout(auth.refreshToken); } finally { dispatch(clearAuth()); navigate('/auth/boxed-signin'); } }}>Sign out</button></div></details></div>
   </header>
   <main id="workspace-content" className={`ws-content ${location.pathname.split('/').length > 3 ? 'ws-detail-page' : ''}`}>
    <Suspense fallback={<div className="ws-page-skeleton" role="status" aria-label="Loading page"><i/><i/><i/></div>}>{children}</Suspense>
   </main>
   <footer className="ws-footer"><span>{branding.companyName || 'Unique NGO'} <span> / </span> Every action makes a difference.</span><span>Operations workspace</span></footer>
  </div>
  <Dialog open={palette} onClose={setPalette} className="ws-overlay"><div className="ws-backdrop"/><DialogPanel className="ws-command"><DialogTitle className="sr-only">Search workspace</DialogTitle><div className="ws-command-input"><Icon name="search"/><input data-autofocus autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search pages, members, products, orders…" aria-label="Search workspace"/><button className="ws-key" onClick={() => setPalette(false)}>Esc</button></div><div className="ws-command-results">
   <p className="ws-eyebrow">Go to</p>{pages.filter(p => p.label.toLowerCase().includes(query.toLowerCase())).map(p => <Link key={p.to} to={p.to} onClick={() => setPalette(false)}><Icon name={iconFor(p.to)}/><span>{p.label}</span><Icon name="arrow"/></Link>)}
   {!query && can('ORDERS:CREATE') && <Link to="/admin/orders?action=create" onClick={() => setPalette(false)}><Icon name="plus"/><span>Record a sale</span><small>Quick action</small></Link>}
   {query.trim().length >= 2 && <><p className="ws-eyebrow">Records</p>{searching && <p role="status" className="ws-search-note">Searching your workspace…</p>}{searchError && <p role="alert" className="ws-search-note">Some records could not be searched. Change your search to retry.</p>}{!searching && !records.length && !searchError && <p className="ws-search-note">No matching records. Try a name or order number.</p>}{records.map(r => <Link key={r.to} to={r.to} onClick={() => setPalette(false)}><Icon name="search"/><span>{r.label}</span><small>{r.kind}</small></Link>)}</>}
  </div><div className="ws-command-footer">Tab to navigate <span>↵ to open</span></div></DialogPanel></Dialog>
  <Dialog open={help} onClose={setHelp} className="ws-overlay"><div className="ws-backdrop"/><DialogPanel className="ws-guide"><button className="ws-icon-button" aria-label="Close guide" onClick={() => setHelp(false)}><Icon name="close"/></button><span className="ws-eyebrow">Your workspace, explained</span><DialogTitle>Less searching. More impact.</DialogTitle><p>Use <kbd>Ctrl / ⌘ K</kbd> to find a page, member, product, campaign, or order from anywhere.</p><h3>Impact & community</h3><p>Coordinate blood requests, appointments, donations, and your hospital network.</p><h3>Marketplace</h3><p>Review products, fulfill orders, and manage seller relationships.</p><h3>Working with records</h3><p>Use filters to narrow a list, select rows for bulk actions, and open the row menu for editing. Table sorting applies to the current page.</p></DialogPanel></Dialog>
 </div>;
}
