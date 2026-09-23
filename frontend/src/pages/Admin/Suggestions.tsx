import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { AdminDataTable, AdminPageHeader } from '../../components/Admin/AdminTable';
import { RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';

const STATUSES = ['NEW', 'REVIEWING', 'PLANNED', 'IMPLEMENTED', 'DECLINED'];
export default function Suggestions() {
    const dispatch = useDispatch(); const navigate = useNavigate();
    const [items, setItems] = useState<any[]>([]); const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [pageSize, setPageSize] = useState(20); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
    const load = async (page = 1, size = pageSize, nextSearch = search, nextStatus = status) => { setLoading(true); setError(''); try { const data = await adminApi.listSuggestions({ page, limit: size, search: nextSearch || undefined, status: nextStatus || undefined }); setItems(data.items); setMeta(data.meta); } catch (err) { setError(getErrorMessage(err)); } finally { setLoading(false); } };
    useEffect(() => { dispatch(setPageTitle('Suggestions & Ideas')); load(); // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const remove = async (id: string) => { if (!await confirmAction('Delete this suggestion?')) return; try { await adminApi.deleteSuggestion(id); showAlert('Suggestion deleted successfully'); await load(meta.page); } catch (err) { showAlert(getErrorMessage(err), 'error'); } };
    return <div><AdminPageHeader title="Suggestions & Ideas" subtitle="Customer feedback submitted from the app" search={search} onSearchChange={setSearch} onSearch={() => load(1, pageSize)} onClear={() => { setSearch(''); setStatus(''); load(1, pageSize, '', ''); }} canClear={Boolean(search || status)} filters={<select className="form-select w-full sm:w-auto min-w-[160px]" value={status} onChange={(e) => { setStatus(e.target.value); load(1, pageSize, search, e.target.value); }}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>} />
        {error && <div role="alert" className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div>}
        <AdminDataTable selectable={false} columns={[{ key: 'title', label: 'Suggestion', render: (row) => <div><div className="font-semibold">{row.title}</div><div className="text-xs text-white-dark">{row.category} · {row.details}</div></div> }, { key: 'customer', label: 'Customer', render: (row) => <div><div>{row.customer?.name || '—'}</div><div className="text-xs text-white-dark">{row.customer?.email || row.customer?.mobile || '—'}</div></div> }, { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> }, { key: 'createdAt', label: 'Received', sortable: true, sortValue: (row) => row.createdAt, render: (row) => new Date(row.createdAt).toLocaleDateString() }]} rows={items} loading={loading} page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={pageSize} onPageChange={(p) => load(p)} onPageSizeChange={(s) => { setPageSize(s); load(1, s); }} actions={(row) => <RowActionsMenu actions={[{ label: 'View', onClick: () => navigate(`/admin/suggestions/${row.id}`) }, { label: 'Delete', danger: true, onClick: () => remove(row.id) }]} />} /></div>;
}
