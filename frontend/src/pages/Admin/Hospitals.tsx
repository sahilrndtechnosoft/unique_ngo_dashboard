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

const emptyForm = {
    name: '',
    registrationNo: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    contactName: '',
    contactMobile: '',
    contactEmail: '',
    sheetUrl: '',
    isActive: true,
};

export default function AdminHospitals() {
    const dispatch = useDispatch();
    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<Mode | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);

    const ids = useMemo(() => items.map((item) => item.id), [items]);
    const selection = useRowSelection(ids);

    const load = async (page = 1, size = pageSize, filters?: { search?: string }) => {
        const nextSearch = filters?.search ?? search;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listHospitals({ page, limit: size, search: nextSearch || undefined });
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
        load(1, pageSize, { search: '' });
    };

    useEffect(() => {
        dispatch(setPageTitle('Hospitals'));
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setMode('create');
    };

    const fillForm = (hospital: any) => {
        setEditingId(hospital.id);
        setForm({
            name: hospital.name,
            registrationNo: hospital.registrationNo ?? '',
            address: hospital.address,
            city: hospital.city,
            state: hospital.state,
            postalCode: hospital.postalCode ?? '',
            contactName: hospital.contactName ?? '',
            contactMobile: hospital.contactMobile ?? '',
            contactEmail: hospital.contactEmail ?? '',
            sheetUrl: hospital.sheetUrl ?? '',
            isActive: hospital.isActive,
        });
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const body = {
                name: form.name,
                registrationNo: form.registrationNo || undefined,
                address: form.address,
                city: form.city,
                state: form.state,
                postalCode: form.postalCode || undefined,
                contactName: form.contactName || undefined,
                contactMobile: form.contactMobile || undefined,
                contactEmail: form.contactEmail || undefined,
                sheetUrl: form.sheetUrl || undefined,
                isActive: form.isActive,
            };
            if (mode === 'create') {
                await adminApi.createHospital(body);
                showAlert('Hospital created successfully');
            } else if (editingId) {
                await adminApi.updateHospital(editingId, body);
                showAlert('Hospital updated successfully');
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
        const ok = await confirmAction('Delete hospital?');
        if (!ok) return;
        try {
            await adminApi.deleteHospital(id);
            showAlert('Hospital deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDelete = async () => {
        const ok = await confirmAction(`Delete ${selection.selectedIds.length} hospitals?`);
        if (!ok) return;
        try {
            for (const id of selection.selectedIds) await adminApi.deleteHospital(id);
            selection.clear();
            showAlert('Selected hospitals deleted');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const readOnly = mode === 'view';

    return (
        <div>
            <AdminPageHeader
                title="Hospitals"
                subtitle="Registered hospitals for blood donation bookings"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                onClear={clearFilters}
                canClear={Boolean(search)}
                onCreate={openCreate}
                createLabel="Add Hospital"
            />

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

            <BulkActionsBar count={selection.selectedIds.length} onClear={selection.clear} onBulkDelete={bulkDelete} />

            <AdminDataTable
                columns={[
                    {
                        key: 'name',
                        label: 'Name',
                        sortable: true,
                        sortValue: (row) => row.name,
                        render: (row) => <span className="font-semibold">{row.name}</span>,
                    },
                    {
                        key: 'location',
                        label: 'Location',
                        render: (row) => `${row.city}, ${row.state}`,
                    },
                    {
                        key: 'contact',
                        label: 'Contact',
                        render: (row) => row.contactMobile || row.contactEmail || '—',
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        sortable: true,
                        sortValue: (row) => (row.isActive ? 'ACTIVE' : 'INACTIVE'),
                        render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
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
                title={mode === 'create' ? 'Add Hospital' : mode === 'edit' ? 'Edit Hospital' : 'View Hospital'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                readOnly={readOnly}
                busy={busy}
            >
                <FormSection title="Hospital details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Name" required>
                            <input className="form-input" required disabled={readOnly} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </FormField>
                        <FormField label="Registration No.">
                            <input className="form-input" disabled={readOnly} value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} />
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
                        <FormField label="Postal Code">
                            <input className="form-input" disabled={readOnly} value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
                        </FormField>
                        <FormField label="Active">
                            <div className="flex items-center h-[38px]">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox"
                                        disabled={readOnly}
                                        checked={form.isActive}
                                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                    />
                                    Active
                                </label>
                            </div>
                        </FormField>
                        <FormField label="Contact Name">
                            <input className="form-input" disabled={readOnly} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                        </FormField>
                        <FormField label="Contact Mobile">
                            <input className="form-input" disabled={readOnly} value={form.contactMobile} onChange={(e) => setForm({ ...form, contactMobile: e.target.value })} />
                        </FormField>
                        <FormField label="Contact Email">
                            <input className="form-input" type="email" disabled={readOnly} value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                        </FormField>
                        <FormField label="Connected Sheet URL" className="md:col-span-2" hint="Google Sheet link the hospital logs donations in, used for reconciliation">
                            <input className="form-input" disabled={readOnly} value={form.sheetUrl} onChange={(e) => setForm({ ...form, sheetUrl: e.target.value })} />
                        </FormField>
                    </div>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
