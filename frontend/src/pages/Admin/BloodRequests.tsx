import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { useRowSelection } from '../../hooks/useRowSelection';
import { AdminDataTable, AdminPageHeader, BulkActionsBar } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';

type Mode = 'create' | 'edit' | 'view';

const BLOOD_GROUPS = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'];
const URGENCY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const REQUEST_STATUSES = ['OPEN', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'EXPIRED'];

const emptyForm = {
    userId: '',
    patientName: '',
    bloodGroup: '',
    unitsRequired: '1',
    unitsFulfilled: '0',
    urgency: 'MEDIUM',
    hospitalName: '',
    hospitalAddress: '',
    city: '',
    state: '',
    contactName: '',
    contactMobile: '',
    requiredByDate: '',
    notes: '',
    isEmergency: false,
    status: 'OPEN',
    adminNote: '',
};

export default function AdminBloodRequests() {
    const dispatch = useDispatch();
    const [items, setItems] = useState<any[]>([]);
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

    const ids = useMemo(() => items.map((item) => item.id), [items]);
    const selection = useRowSelection(ids);

    const load = async (page = 1, size = pageSize, filters?: { search?: string; status?: string }) => {
        const nextSearch = filters?.search ?? search;
        const nextStatus = filters?.status ?? statusFilter;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listBloodRequests({
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
        dispatch(setPageTitle('Blood Requests'));
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setMode('create');
    };

    const fillForm = (request: any) => {
        setEditingId(request.id);
        setForm({
            userId: request.requesterId,
            patientName: request.patientName,
            bloodGroup: request.bloodGroup,
            unitsRequired: String(request.unitsRequired),
            unitsFulfilled: String(request.unitsFulfilled),
            urgency: request.urgency,
            hospitalName: request.hospitalName,
            hospitalAddress: request.hospitalAddress,
            city: request.city,
            state: request.state,
            contactName: request.contactName,
            contactMobile: request.contactMobile,
            requiredByDate: request.requiredByDate.slice(0, 10),
            notes: request.notes ?? '',
            isEmergency: request.isEmergency,
            status: request.status,
            adminNote: request.adminNote ?? '',
        });
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            if (mode === 'create') {
                await adminApi.createBloodRequest({
                    userId: form.userId,
                    patientName: form.patientName,
                    bloodGroup: form.bloodGroup,
                    unitsRequired: Number(form.unitsRequired) || 1,
                    urgency: form.urgency,
                    hospitalName: form.hospitalName,
                    hospitalAddress: form.hospitalAddress,
                    city: form.city,
                    state: form.state,
                    contactName: form.contactName,
                    contactMobile: form.contactMobile,
                    requiredByDate: form.requiredByDate,
                    notes: form.notes || undefined,
                    isEmergency: form.isEmergency,
                });
                showAlert('Blood request created successfully');
            } else if (editingId) {
                await adminApi.updateBloodRequest(editingId, {
                    patientName: form.patientName,
                    bloodGroup: form.bloodGroup,
                    unitsRequired: Number(form.unitsRequired) || 1,
                    unitsFulfilled: Number(form.unitsFulfilled) || 0,
                    urgency: form.urgency,
                    hospitalName: form.hospitalName,
                    hospitalAddress: form.hospitalAddress,
                    city: form.city,
                    state: form.state,
                    contactName: form.contactName,
                    contactMobile: form.contactMobile,
                    requiredByDate: form.requiredByDate,
                    notes: form.notes || undefined,
                    isEmergency: form.isEmergency,
                    status: form.status,
                    adminNote: form.adminNote || undefined,
                });
                showAlert('Blood request updated successfully');
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
        const ok = await confirmAction('Delete blood request?');
        if (!ok) return;
        try {
            await adminApi.deleteBloodRequest(id);
            showAlert('Blood request deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDelete = async () => {
        const ok = await confirmAction(`Delete ${selection.selectedIds.length} blood request(s)?`);
        if (!ok) return;
        try {
            for (const id of selection.selectedIds) await adminApi.deleteBloodRequest(id);
            selection.clear();
            showAlert('Selected blood requests deleted');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const readOnly = mode === 'view';

    return (
        <div>
            <AdminPageHeader
                title="Blood Requests"
                subtitle="Blood requests raised by users through the app"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                onClear={clearFilters}
                canClear={Boolean(search || statusFilter)}
                onCreate={openCreate}
                createLabel="Add Request"
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
                        {REQUEST_STATUSES.map((status) => (
                            <option key={status} value={status}>
                                {status.replace('_', ' ')}
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
                        key: 'patientName',
                        label: 'Patient',
                        sortable: true,
                        sortValue: (row) => row.patientName,
                        render: (row) => (
                            <div>
                                <div className="font-semibold">{row.patientName}</div>
                                <div className="text-xs text-white-dark">{row.bloodGroup.replace('_', ' ')}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'units',
                        label: 'Units',
                        render: (row) => `${row.unitsFulfilled} / ${row.unitsRequired}`,
                    },
                    {
                        key: 'urgency',
                        label: 'Urgency',
                        sortable: true,
                        sortValue: (row) => row.urgency,
                        render: (row) => <StatusBadge status={row.isEmergency ? 'CRITICAL' : row.urgency} />,
                    },
                    {
                        key: 'hospital',
                        label: 'Hospital',
                        render: (row) => `${row.hospitalName}, ${row.city}`,
                    },
                    {
                        key: 'contact',
                        label: 'Contact',
                        render: (row) => (
                            <div>
                                <div>{row.contactName}</div>
                                <div className="text-xs text-white-dark">{row.contactMobile}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'requiredByDate',
                        label: 'Required By',
                        sortable: true,
                        sortValue: (row) => row.requiredByDate,
                        render: (row) => new Date(row.requiredByDate).toLocaleDateString(),
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
                            {
                                label: 'View',
                                onClick: () => {
                                    fillForm(row);
                                    setMode('view');
                                },
                            },
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
                title={mode === 'create' ? 'Add Blood Request' : mode === 'edit' ? 'Edit Blood Request' : 'View Blood Request'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                readOnly={readOnly}
                busy={busy}
                size="xl"
            >
                <FormSection title="Patient & Requester" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {mode === 'create' ? (
                            <FormField label="Requesting User ID" required hint="UUID of the user this request is raised for">
                                <input className="form-input" required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} />
                            </FormField>
                        ) : null}
                        <FormField label="Patient Name" required>
                            <input className="form-input" required disabled={readOnly} value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
                        </FormField>
                        <FormField label="Blood Group" required>
                            <select className="form-select" required disabled={readOnly} value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                                <option value="">Select blood group</option>
                                {BLOOD_GROUPS.map((group) => (
                                    <option key={group} value={group}>
                                        {group.replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Units Required" required>
                            <input className="form-input" type="number" min={0.5} step={0.5} required disabled={readOnly} value={form.unitsRequired} onChange={(e) => setForm({ ...form, unitsRequired: e.target.value })} />
                        </FormField>
                        {mode !== 'create' ? (
                            <FormField label="Units Fulfilled">
                                <input className="form-input" type="number" min={0} step={0.5} disabled={readOnly} value={form.unitsFulfilled} onChange={(e) => setForm({ ...form, unitsFulfilled: e.target.value })} />
                            </FormField>
                        ) : null}
                        <FormField label="Urgency" required>
                            <select className="form-select" required disabled={readOnly} value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                                {URGENCY_LEVELS.map((level) => (
                                    <option key={level} value={level}>
                                        {level}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Required By" required>
                            <input className="form-input" type="date" required disabled={readOnly} value={form.requiredByDate} onChange={(e) => setForm({ ...form, requiredByDate: e.target.value })} />
                        </FormField>
                        <FormField label="Emergency">
                            <div className="flex items-center h-[38px]">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="form-checkbox" disabled={readOnly} checked={form.isEmergency} onChange={(e) => setForm({ ...form, isEmergency: e.target.checked })} />
                                    Mark as emergency
                                </label>
                            </div>
                        </FormField>
                    </div>
                </FormSection>

                <FormSection title="Hospital & Contact" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Hospital Name" required>
                            <input className="form-input" required disabled={readOnly} value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} />
                        </FormField>
                        <FormField label="Hospital Address" required className="md:col-span-2">
                            <textarea className="form-textarea" required disabled={readOnly} value={form.hospitalAddress} onChange={(e) => setForm({ ...form, hospitalAddress: e.target.value })} />
                        </FormField>
                        <FormField label="City" required>
                            <input className="form-input" required disabled={readOnly} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                        </FormField>
                        <FormField label="State" required>
                            <input className="form-input" required disabled={readOnly} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                        </FormField>
                        <FormField label="Contact Name" required>
                            <input className="form-input" required disabled={readOnly} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                        </FormField>
                        <FormField label="Contact Mobile" required>
                            <input className="form-input" required disabled={readOnly} value={form.contactMobile} onChange={(e) => setForm({ ...form, contactMobile: e.target.value })} />
                        </FormField>
                        <FormField label="Notes" className="md:col-span-2">
                            <textarea className="form-textarea" disabled={readOnly} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                        </FormField>
                    </div>
                </FormSection>

                {mode !== 'create' ? (
                    <FormSection title="Status & Review" className="md:col-span-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <FormField label="Status" required>
                                <select className="form-select" required disabled={readOnly} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                    {REQUEST_STATUSES.map((status) => (
                                        <option key={status} value={status}>
                                            {status.replace('_', ' ')}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField label="Admin Note" className="md:col-span-2">
                                <textarea className="form-textarea" disabled={readOnly} value={form.adminNote} onChange={(e) => setForm({ ...form, adminNote: e.target.value })} />
                            </FormField>
                        </div>
                    </FormSection>
                ) : null}
            </AdminFormModal>
        </div>
    );
}
