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

type Mode = 'create' | 'edit';

const APPOINTMENT_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
const BLOOD_GROUPS = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'];

const emptyForm = {
    userId: '',
    donorLabel: '',
    donationType: 'hospital' as 'hospital' | 'camp',
    hospitalId: '',
    campaignId: '',
    bloodGroup: '',
    appointmentDate: '',
    timeSlot: '',
    notes: '',
    status: 'PENDING',
    cancelReason: '',
    forSelf: true,
    beneficiaryName: '',
    beneficiaryMobile: '',
    beneficiaryRelation: '',
};

export default function AdminAppointments() {
    const dispatch = useDispatch();
    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('PENDING');
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<Mode | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [donorSearch, setDonorSearch] = useState('');
    const [donorResults, setDonorResults] = useState<any[]>([]);

    const ids = useMemo(() => items.map((item) => item.id), [items]);
    const selection = useRowSelection(ids);

    const searchDonors = async () => {
        if (!donorSearch.trim()) {
            setDonorResults([]);
            return;
        }
        try {
            const data = await adminApi.listUsers({ search: donorSearch, limit: 10 });
            setDonorResults(data.items);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const load = async (page = 1, size = pageSize, filters?: { search?: string; status?: string }) => {
        const nextSearch = filters?.search ?? search;
        const nextStatus = filters?.status ?? statusFilter;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listAppointments({
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
        dispatch(setPageTitle('Appointments'));
        load();
        adminApi.listHospitals({ page: 1, limit: 100, isActive: true }).then((data) => setHospitals(data.items));
        adminApi.listCampaigns({ page: 1, limit: 100 }).then((data) => setCampaigns(data.items));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setDonorSearch('');
        setDonorResults([]);
        setMode('create');
    };

    const openEdit = (appointment: any) => {
        setEditingId(appointment.id);
        setForm({
            userId: appointment.donorId,
            donorLabel: appointment.donor?.fullName ?? appointment.donorId,
            donationType: appointment.campaignId ? 'camp' : 'hospital',
            hospitalId: appointment.hospitalId ?? '',
            campaignId: appointment.campaignId ?? '',
            bloodGroup: appointment.bloodGroup,
            appointmentDate: appointment.appointmentDate.slice(0, 10),
            timeSlot: appointment.timeSlot ?? '',
            notes: appointment.notes ?? '',
            status: appointment.status,
            cancelReason: appointment.cancelReason ?? '',
            forSelf: appointment.forSelf ?? true,
            beneficiaryName: appointment.beneficiary?.name ?? '',
            beneficiaryMobile: appointment.beneficiary?.mobile ?? '',
            beneficiaryRelation: appointment.beneficiary?.relation ?? '',
        });
        setMode('edit');
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (mode === 'create' && !form.userId) {
            showAlert('Select a donor first', 'error');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const body = {
                bloodGroup: form.bloodGroup,
                appointmentDate: form.appointmentDate,
                timeSlot: form.timeSlot || undefined,
                notes: form.notes || undefined,
                hospitalId: form.donationType === 'hospital' ? form.hospitalId || undefined : undefined,
                campaignId: form.donationType === 'camp' ? form.campaignId || undefined : undefined,
                forSelf: form.forSelf,
                beneficiaryName: form.forSelf ? undefined : form.beneficiaryName || undefined,
                beneficiaryMobile: form.forSelf ? undefined : form.beneficiaryMobile || undefined,
                beneficiaryRelation: form.forSelf ? undefined : form.beneficiaryRelation || undefined,
            };
            if (mode === 'create') {
                await adminApi.createAppointment({ ...body, userId: form.userId });
                showAlert('Appointment created successfully');
            } else if (editingId) {
                await adminApi.updateAppointment(editingId, {
                    ...body,
                    status: form.status,
                    cancelReason: form.cancelReason || undefined,
                });
                showAlert('Appointment updated successfully');
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
        const ok = await confirmAction('Delete appointment?');
        if (!ok) return;
        try {
            await adminApi.deleteAppointment(id);
            showAlert('Appointment deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDelete = async () => {
        const ok = await confirmAction(`Delete ${selection.selectedIds.length} appointment(s)?`);
        if (!ok) return;
        try {
            for (const id of selection.selectedIds) await adminApi.deleteAppointment(id);
            selection.clear();
            showAlert('Selected appointments deleted');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Appointments"
                subtitle="Blood donation appointments booked by donors"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                onClear={clearFilters}
                canClear={Boolean(search || statusFilter)}
                onCreate={openCreate}
                createLabel="Add Appointment"
                searchPlaceholder="Search by donor name, email or mobile..."
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
                        {APPOINTMENT_STATUSES.map((status) => (
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
                        key: 'appointmentDate',
                        label: 'Appointment Date',
                        sortable: true,
                        sortValue: (row) => row.appointmentDate,
                        render: (row) => (
                            <div>
                                <div className="font-semibold">{new Date(row.appointmentDate).toLocaleDateString()}</div>
                                <div className="text-xs text-white-dark">{row.timeSlot || '—'}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'donor',
                        label: 'Donor',
                        render: (row) => (
                            <div>
                                <div>{row.forSelf === false ? row.beneficiary?.name : row.donor?.fullName ?? '—'}</div>
                                <div className="text-xs text-white-dark">
                                    {row.forSelf === false ? `On behalf of ${row.donor?.fullName ?? 'account holder'}` : row.donor?.mobile ?? row.donor?.email ?? ''}
                                </div>
                            </div>
                        ),
                    },
                    {
                        key: 'location',
                        label: 'Location',
                        render: (row) => row.hospital?.name ?? row.campaign?.name ?? '—',
                    },
                    {
                        key: 'bloodGroup',
                        label: 'Blood Group',
                        render: (row) => row.bloodGroup.replace('_', ' '),
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
                            { label: 'Edit', onClick: () => openEdit(row) },
                            { label: 'Delete', onClick: () => remove(row.id), danger: true },
                        ]}
                    />
                )}
            />

            <AdminFormModal
                open={mode !== null}
                title={mode === 'create' ? 'Add Appointment' : 'Edit Appointment'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                busy={busy}
            >
                <FormSection title="Appointment details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {mode === 'create' ? (
                            <FormField label="Donor" required className="md:col-span-2" hint="Search by name, email or mobile">
                                {form.userId ? (
                                    <div className="flex items-center justify-between rounded border border-[#ebedf2] p-2 dark:border-[#191e3a]">
                                        <span>{form.donorLabel}</span>
                                        <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => setForm({ ...form, userId: '', donorLabel: '' })}>
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                className="form-input"
                                                value={donorSearch}
                                                onChange={(e) => setDonorSearch(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        searchDonors();
                                                    }
                                                }}
                                            />
                                            <button type="button" className="btn btn-primary btn-sm" onClick={searchDonors}>
                                                Search
                                            </button>
                                        </div>
                                        {donorResults.length > 0 ? (
                                            <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-[#ebedf2] dark:border-[#191e3a]">
                                                {donorResults.map((donor) => (
                                                    <li key={donor.id}>
                                                        <button
                                                            type="button"
                                                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-[#191e3a]"
                                                            onClick={() =>
                                                                setForm({
                                                                    ...form,
                                                                    userId: donor.id,
                                                                    donorLabel: `${donor.fullName} (${donor.email ?? donor.mobile ?? ''})`,
                                                                })
                                                            }
                                                        >
                                                            {donor.fullName} — {donor.email ?? donor.mobile ?? ''}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : null}
                                    </div>
                                )}
                            </FormField>
                        ) : null}
                        <FormField label="Donated At">
                            <div className="flex items-center gap-4 h-[38px]">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={form.donationType === 'hospital'}
                                        onChange={() => setForm({ ...form, donationType: 'hospital', campaignId: '' })}
                                    />
                                    Hospital
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={form.donationType === 'camp'}
                                        onChange={() => setForm({ ...form, donationType: 'camp', hospitalId: '' })}
                                    />
                                    Camp
                                </label>
                            </div>
                        </FormField>
                        {form.donationType === 'hospital' ? (
                            <FormField label="Hospital">
                                <select className="form-select" value={form.hospitalId} onChange={(e) => setForm({ ...form, hospitalId: e.target.value })}>
                                    <option value="">Select hospital</option>
                                    {hospitals.map((hospital) => (
                                        <option key={hospital.id} value={hospital.id}>
                                            {hospital.name}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                        ) : (
                            <FormField label="Camp / Campaign">
                                <select className="form-select" value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
                                    <option value="">Select camp</option>
                                    {campaigns.map((campaign) => (
                                        <option key={campaign.id} value={campaign.id}>
                                            {campaign.name}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                        )}
                        <FormField label="Blood Group" required>
                            <select className="form-select" required value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                                <option value="">Select blood group</option>
                                {BLOOD_GROUPS.map((group) => (
                                    <option key={group} value={group}>
                                        {group.replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Appointment Date" required>
                            <input className="form-input" type="date" required value={form.appointmentDate} onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })} />
                        </FormField>
                        <FormField label="Time Slot">
                            <input className="form-input" value={form.timeSlot} onChange={(e) => setForm({ ...form, timeSlot: e.target.value })} />
                        </FormField>
                        {mode === 'edit' ? (
                            <FormField label="Status">
                                <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                    {APPOINTMENT_STATUSES.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                        ) : null}
                        {mode === 'edit' && form.status === 'CANCELLED' ? (
                            <FormField label="Cancel Reason" className="md:col-span-2">
                                <input className="form-input" value={form.cancelReason} onChange={(e) => setForm({ ...form, cancelReason: e.target.value })} />
                            </FormField>
                        ) : null}
                        <FormField label="Notes" className="md:col-span-2">
                            <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                        </FormField>
                    </div>
                </FormSection>

                <FormSection title="Who is donating?" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Donating For" className="md:col-span-2">
                            <div className="flex items-center gap-4 h-[38px]">
                                <label className="flex items-center gap-2">
                                    <input type="radio" checked={form.forSelf} onChange={() => setForm({ ...form, forSelf: true })} />
                                    The donor themselves
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="radio" checked={!form.forSelf} onChange={() => setForm({ ...form, forSelf: false })} />
                                    On behalf of someone else
                                </label>
                            </div>
                        </FormField>
                        {!form.forSelf ? (
                            <>
                                <FormField label="Beneficiary Name" required>
                                    <input
                                        className="form-input"
                                        required
                                        value={form.beneficiaryName}
                                        onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })}
                                    />
                                </FormField>
                                <FormField label="Beneficiary Mobile" required>
                                    <input
                                        className="form-input"
                                        required
                                        value={form.beneficiaryMobile}
                                        onChange={(e) => setForm({ ...form, beneficiaryMobile: e.target.value })}
                                    />
                                </FormField>
                                <FormField label="Relation to Account Holder" required>
                                    <input
                                        className="form-input"
                                        required
                                        placeholder="e.g. Spouse, Parent, Friend"
                                        value={form.beneficiaryRelation}
                                        onChange={(e) => setForm({ ...form, beneficiaryRelation: e.target.value })}
                                    />
                                </FormField>
                            </>
                        ) : null}
                    </div>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
