import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage, mediaUrl } from '../../services/api';
import { useRowSelection } from '../../hooks/useRowSelection';
import { AdminDataTable, AdminPageHeader, BulkActionsBar } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';

type Mode = 'create' | 'edit' | 'view';

const CAMPAIGN_TYPES = ['BLOOD', 'DONATION', 'AWARENESS', 'EMERGENCY', 'MEDICAL', 'FUNDRAISING'];
const CAMPAIGN_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'REJECTED'];

const toDateInput = (value?: string) => (value ? value.slice(0, 10) : '');

const emptyForm = {
    name: '',
    description: '',
    type: 'BLOOD',
    status: 'DRAFT',
    hospitalId: '',
    venueName: '',
    address: '',
    city: '',
    state: '',
    organizerName: '',
    organizerMobile: '',
    startsAt: '',
    endsAt: '',
    targetUnits: '',
    sheetUrl: '',
    bannerUrl: '' as string | null,
};

export default function AdminCampaigns() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [items, setItems] = useState<any[]>([]);
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<Mode | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [pendingBanner, setPendingBanner] = useState<File | null>(null);

    const ids = useMemo(() => items.map((item) => item.id), [items]);
    const selection = useRowSelection(ids);

    const load = async (page = 1, size = pageSize, filters?: { search?: string; status?: string }) => {
        const nextSearch = filters?.search ?? search;
        const nextStatus = filters?.status ?? statusFilter;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listCampaigns({
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
        dispatch(setPageTitle('Blood Campaigns'));
        load();
        adminApi.listHospitals({ page: 1, limit: 100, isActive: true }).then((data) => setHospitals(data.items));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setPendingBanner(null);
        setMode('create');
    };

    const fillForm = (campaign: any) => {
        setEditingId(campaign.id);
        setForm({
            name: campaign.name,
            description: campaign.description ?? '',
            type: campaign.type,
            status: campaign.status,
            hospitalId: campaign.hospitalId ?? '',
            venueName: campaign.venueName ?? '',
            address: campaign.address,
            city: campaign.city,
            state: campaign.state,
            organizerName: campaign.organizerName ?? '',
            organizerMobile: campaign.organizerMobile ?? '',
            startsAt: toDateInput(campaign.startsAt),
            endsAt: toDateInput(campaign.endsAt),
            targetUnits: campaign.targetUnits != null ? String(campaign.targetUnits) : '',
            sheetUrl: campaign.sheetUrl ?? '',
            bannerUrl: campaign.bannerUrl,
        });
        setPendingBanner(null);
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const body = {
                name: form.name,
                description: form.description || undefined,
                type: form.type,
                status: form.status,
                hospitalId: form.hospitalId || undefined,
                venueName: form.venueName || undefined,
                address: form.address,
                city: form.city,
                state: form.state,
                organizerName: form.organizerName || undefined,
                organizerMobile: form.organizerMobile || undefined,
                startsAt: form.startsAt,
                endsAt: form.endsAt,
                targetUnits: form.targetUnits ? Number(form.targetUnits) : undefined,
                sheetUrl: form.sheetUrl || undefined,
            };
            let id = editingId;
            if (mode === 'create') {
                const created = (await adminApi.createCampaign(body)) as any;
                id = created?.id;
                showAlert('Campaign created successfully');
            } else if (editingId) {
                await adminApi.updateCampaign(editingId, body);
                showAlert('Campaign updated successfully');
            }
            if (id && pendingBanner) {
                await adminApi.uploadCampaignBanner(id, pendingBanner);
            }
            setMode(null);
            selection.clear();
            await load(meta.page, pageSize);
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: string) => {
        const ok = await confirmAction('Delete campaign?');
        if (!ok) return;
        try {
            await adminApi.deleteCampaign(id);
            showAlert('Campaign deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDelete = async () => {
        const ok = await confirmAction(`Delete ${selection.selectedIds.length} campaigns?`);
        if (!ok) return;
        try {
            for (const id of selection.selectedIds) await adminApi.deleteCampaign(id);
            selection.clear();
            showAlert('Selected campaigns deleted');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const readOnly = mode === 'view';

    return (
        <div>
            <AdminPageHeader
                title="Blood Campaigns"
                subtitle="Blood donation camps and drives"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                onClear={clearFilters}
                canClear={Boolean(search) || Boolean(statusFilter)}
                onCreate={openCreate}
                createLabel="Add Campaign"
                filters={
                    <select
                        className="form-select w-full sm:w-auto min-w-[160px] shrink-0"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            load(1, pageSize, { status: e.target.value });
                        }}
                    >
                        <option value="">All Statuses</option>
                        {CAMPAIGN_STATUSES.map((status) => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </select>
                }
            />

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

            <BulkActionsBar count={selection.selectedIds.length} onClear={selection.clear} onBulkDelete={bulkDelete} />

            <AdminDataTable
                columns={[
                    {
                        key: 'banner',
                        label: 'Banner',
                        render: (row) =>
                            row.bannerUrl ? (
                                <img src={mediaUrl(row.bannerUrl)} alt={row.name} className="h-10 w-16 rounded object-cover" />
                            ) : (
                                <span className="text-xs text-white-dark">—</span>
                            ),
                    },
                    {
                        key: 'name',
                        label: 'Name',
                        sortable: true,
                        sortValue: (row) => row.name,
                        render: (row) => (
                            <div>
                                <div className="font-semibold">{row.name}</div>
                                <div className="text-xs text-white-dark">{row.city}, {row.state}</div>
                            </div>
                        ),
                    },
                    { key: 'type', label: 'Type', render: (row) => row.type },
                    {
                        key: 'dates',
                        label: 'Dates',
                        render: (row) => `${toDateInput(row.startsAt)} → ${toDateInput(row.endsAt)}`,
                    },
                    {
                        key: 'units',
                        label: 'Units Collected',
                        render: (row) => `${row.unitsCollected}${row.targetUnits ? ` / ${row.targetUnits}` : ''}`,
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
                            { label: 'View', onClick: () => navigate(`/admin/campaigns/${row.id}`) },
                            {
                                label: 'Edit',
                                onClick: () => {
                                    fillForm(row);
                                    setMode('edit');
                                },
                            },
                            { label: 'Delete', onClick: () => remove(row.id), danger: true },
                        ]}
                    />
                )}
            />

            <AdminFormModal
                open={mode !== null}
                title={mode === 'create' ? 'Add Campaign' : mode === 'edit' ? 'Edit Campaign' : 'View Campaign'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                readOnly={readOnly}
                busy={busy}
                size="lg"
            >
                <FormSection title="Campaign details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Name" required>
                            <input className="form-input" required disabled={readOnly} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </FormField>
                        <FormField label="Hospital" hint="Optional if the camp isn't hosted at a registered hospital">
                            <select className="form-select" disabled={readOnly} value={form.hospitalId} onChange={(e) => setForm({ ...form, hospitalId: e.target.value })}>
                                <option value="">None</option>
                                {hospitals.map((hospital) => (
                                    <option key={hospital.id} value={hospital.id}>
                                        {hospital.name}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Type">
                            <select className="form-select" disabled={readOnly} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                                {CAMPAIGN_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Status">
                            <select className="form-select" disabled={readOnly} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                {CAMPAIGN_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Starts On" required>
                            <input className="form-input" type="date" required disabled={readOnly} value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                        </FormField>
                        <FormField label="Ends On" required>
                            <input className="form-input" type="date" required disabled={readOnly} value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
                        </FormField>
                        <FormField label="Venue Name">
                            <input className="form-input" disabled={readOnly} value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} />
                        </FormField>
                        <FormField label="Target Units">
                            <input className="form-input" type="number" min={1} disabled={readOnly} value={form.targetUnits} onChange={(e) => setForm({ ...form, targetUnits: e.target.value })} />
                        </FormField>
                        <FormField label="Address" className="md:col-span-2" required>
                            <textarea className="form-textarea" required disabled={readOnly} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                        </FormField>
                        <FormField label="City" required>
                            <input className="form-input" required disabled={readOnly} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                        </FormField>
                        <FormField label="State" required>
                            <input className="form-input" required disabled={readOnly} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                        </FormField>
                        <FormField label="Organizer Name">
                            <input className="form-input" disabled={readOnly} value={form.organizerName} onChange={(e) => setForm({ ...form, organizerName: e.target.value })} />
                        </FormField>
                        <FormField label="Organizer Mobile">
                            <input className="form-input" disabled={readOnly} value={form.organizerMobile} onChange={(e) => setForm({ ...form, organizerMobile: e.target.value })} />
                        </FormField>
                        <FormField label="Description" className="md:col-span-2">
                            <textarea className="form-textarea min-h-[80px]" disabled={readOnly} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </FormField>
                        <FormField label="Connected Sheet URL" className="md:col-span-2" hint="Google Sheet link the camp logs donations in, used for reconciliation">
                            <input className="form-input" disabled={readOnly} value={form.sheetUrl} onChange={(e) => setForm({ ...form, sheetUrl: e.target.value })} />
                        </FormField>
                        <FormField label="Banner" className="md:col-span-2">
                            <div className="flex items-center gap-4">
                                {form.bannerUrl ? <img src={mediaUrl(form.bannerUrl)} alt="" className="h-16 w-28 rounded object-cover" /> : null}
                                {!readOnly ? (
                                    <input type="file" accept="image/*" className="form-input" onChange={(e) => setPendingBanner(e.target.files?.[0] ?? null)} />
                                ) : null}
                            </div>
                        </FormField>
                    </div>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
