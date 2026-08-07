import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage, mediaUrl } from '../../services/api';
import { useRowSelection } from '../../hooks/useRowSelection';
import { AdminDataTable, AdminPageHeader, BulkActionsBar } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, promptReason, showAlert } from '../../utils/alerts';

const STATUSES = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'];
const BLOOD_GROUPS = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'];

type CrudMode = 'create' | 'edit';

const emptyRecordForm = {
    hospitalId: '',
    campaignId: '',
    donationType: 'hospital' as 'hospital' | 'camp',
    donorName: '',
    donorMobile: '',
    donorEmail: '',
    bloodGroup: '',
    units: '',
    donationDate: '',
};

const emptyDonationForm = {
    userId: '',
    donorLabel: '',
    donationType: 'hospital' as 'hospital' | 'camp',
    hospitalId: '',
    campaignId: '',
    bloodGroup: '',
    donationDate: '',
    unitsDonated: '1',
    donationCenter: '',
    hospitalName: '',
    city: '',
    state: '',
    notes: '',
};

export default function AdminBloodDonations() {
    const dispatch = useDispatch();
    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [donationDateFilter, setDonationDateFilter] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [selectedDonation, setSelectedDonation] = useState<any>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const [records, setRecords] = useState<any[]>([]);
    const [recordsLoading, setRecordsLoading] = useState(false);
    const [recordsUnmatchedOnly, setRecordsUnmatchedOnly] = useState(true);
    const [recordsSearch, setRecordsSearch] = useState('');
    const [importHospitalId, setImportHospitalId] = useState('');
    const [importCampaignId, setImportCampaignId] = useState('');
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);

    const [recordMode, setRecordMode] = useState<CrudMode | null>(null);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [recordForm, setRecordForm] = useState(emptyRecordForm);
    const [recordBusy, setRecordBusy] = useState(false);
    const [candidatesRecordId, setCandidatesRecordId] = useState<string | null>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [candidatesLoading, setCandidatesLoading] = useState(false);

    const [crudMode, setCrudMode] = useState<CrudMode | null>(null);
    const [editingDonationId, setEditingDonationId] = useState<string | null>(null);
    const [donationForm, setDonationForm] = useState(emptyDonationForm);
    const [crudBusy, setCrudBusy] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [donorSearch, setDonorSearch] = useState('');
    const [donorResults, setDonorResults] = useState<any[]>([]);

    const ids = useMemo(() => items.map((item) => item.id), [items]);
    const selection = useRowSelection(ids);

    const recordIds = useMemo(() => records.map((record) => record.id), [records]);
    const recordSelection = useRowSelection(recordIds);

    const load = async (
        page = 1,
        size = pageSize,
        filters?: { search?: string; status?: string; donationDate?: string },
    ) => {
        const nextSearch = filters?.search ?? search;
        const nextStatus = filters?.status ?? statusFilter;
        const nextDonationDate = filters?.donationDate ?? donationDateFilter;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listDonations({
                page,
                limit: size,
                search: nextSearch || undefined,
                status: nextStatus || undefined,
                donationDate: nextDonationDate || undefined,
            });
            setItems(data.items);
            setMeta(data.meta);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const loadRecords = async (unmatchedOnly = recordsUnmatchedOnly, searchValue = recordsSearch) => {
        setRecordsLoading(true);
        try {
            const data = await adminApi.listDonationSheetRecords({
                page: 1,
                limit: 50,
                unmatchedOnly: unmatchedOnly || undefined,
                search: searchValue || undefined,
            });
            setRecords(data.items);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setRecordsLoading(false);
        }
    };

    useEffect(() => {
        dispatch(setPageTitle('Blood Donations'));
        load();
        loadRecords();
        adminApi.listHospitals({ page: 1, limit: 100, isActive: true }).then((data) => setHospitals(data.items));
        adminApi.listCampaigns({ page: 1, limit: 100 }).then((data) => setCampaigns(data.items));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const viewDonation = async (id: string) => {
        setBusy(true);
        try {
            const donation = (await adminApi.getDonation(id)) as any;
            setSelectedDonation(donation);
            setRejectionReason('');
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const closeView = () => setSelectedDonation(null);

    const canReview = selectedDonation && ['PENDING', 'UNDER_REVIEW'].includes(selectedDonation.status);

    const approve = async () => {
        if (!selectedDonation) return;
        setBusy(true);
        try {
            const updated = await adminApi.reviewDonation(selectedDonation.id, { status: 'APPROVED' });
            setSelectedDonation(updated);
            showAlert('Donation approved and reward credited to the donor');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const reject = async () => {
        if (!selectedDonation) return;
        if (!rejectionReason.trim()) {
            showAlert('A rejection reason is required', 'error');
            return;
        }
        setBusy(true);
        try {
            const updated = await adminApi.reviewDonation(selectedDonation.id, {
                status: 'REJECTED',
                rejectionReason,
            });
            setSelectedDonation(updated);
            showAlert('Donation rejected');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const importSheet = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!importHospitalId && !importCampaignId) {
            showAlert('Select a hospital or campaign before importing', 'error');
            return;
        }
        try {
            const result = (await adminApi.importDonationSheet(file, importHospitalId || undefined, importCampaignId || undefined)) as any;
            showAlert(`Imported ${result.imported} rows — ${result.autoMatched} auto-matched to genuine donations, ${result.unmatched} need manual review`);
            await loadRecords();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const openCreateRecord = () => {
        setEditingRecordId(null);
        setRecordForm(emptyRecordForm);
        setRecordMode('create');
    };

    const openEditRecord = (record: any) => {
        setEditingRecordId(record.id);
        setRecordForm({
            hospitalId: record.hospitalId ?? '',
            campaignId: record.campaignId ?? '',
            donationType: record.campaignId ? 'camp' : 'hospital',
            donorName: record.donorName ?? '',
            donorMobile: record.donorMobile ?? '',
            donorEmail: record.donorEmail ?? '',
            bloodGroup: record.bloodGroup ?? '',
            units: record.units != null ? String(record.units) : '',
            donationDate: record.donationDate ? record.donationDate.slice(0, 10) : '',
        });
        setRecordMode('edit');
    };

    const submitRecordForm = async (event: FormEvent) => {
        event.preventDefault();
        setRecordBusy(true);
        try {
            const body: Record<string, unknown> = {
                hospitalId: recordForm.donationType === 'hospital' ? recordForm.hospitalId || undefined : undefined,
                campaignId: recordForm.donationType === 'camp' ? recordForm.campaignId || undefined : undefined,
                donorName: recordForm.donorName || undefined,
                donorMobile: recordForm.donorMobile || undefined,
                donorEmail: recordForm.donorEmail || undefined,
                bloodGroup: recordForm.bloodGroup || undefined,
                units: recordForm.units || undefined,
                donationDate: recordForm.donationDate || undefined,
            };
            if (recordMode === 'create') {
                await adminApi.createDonationSheetRecord(body);
                showAlert('Sheet record created — matched automatically if a genuine donation was found');
            } else if (editingRecordId) {
                await adminApi.updateDonationSheetRecord(editingRecordId, body);
                showAlert('Sheet record updated successfully');
            }
            setRecordMode(null);
            await loadRecords();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setRecordBusy(false);
        }
    };

    const removeRecord = async (recordId: string) => {
        const ok = await confirmAction('Delete sheet record?');
        if (!ok) return;
        try {
            await adminApi.deleteDonationSheetRecord(recordId);
            showAlert('Sheet record deleted successfully');
            await loadRecords();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDeleteRecords = async () => {
        const ok = await confirmAction(`Delete ${recordSelection.selectedIds.length} sheet record(s)?`);
        if (!ok) return;
        try {
            for (const id of recordSelection.selectedIds) await adminApi.deleteDonationSheetRecord(id);
            recordSelection.clear();
            showAlert('Selected sheet records deleted');
            await loadRecords();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const unmatchRecord = async (recordId: string) => {
        try {
            await adminApi.updateDonationSheetRecord(recordId, { matchedDonationId: null });
            showAlert('Sheet record unmatched');
            await loadRecords();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const openCandidates = async (recordId: string) => {
        setCandidatesRecordId(recordId);
        setCandidatesLoading(true);
        try {
            const data = await adminApi.getDonationSheetRecordCandidates(recordId);
            setCandidates(data);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setCandidatesLoading(false);
        }
    };

    const selectCandidate = async (donationId: string) => {
        if (!candidatesRecordId) return;
        try {
            await adminApi.matchDonationSheetRecord(candidatesRecordId, donationId);
            showAlert('Sheet record matched — this donation is verified as genuine');
            setCandidatesRecordId(null);
            await loadRecords();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const openCreateDonation = () => {
        setEditingDonationId(null);
        setDonationForm(emptyDonationForm);
        setPendingFile(null);
        setDonorSearch('');
        setDonorResults([]);
        setCrudMode('create');
    };

    const openEditDonation = (row: any) => {
        setEditingDonationId(row.id);
        setDonationForm({
            userId: row.donorId,
            donorLabel: row.donor?.fullName ?? row.donorId,
            donationType: row.campaignId ? 'camp' : 'hospital',
            hospitalId: row.hospitalId ?? '',
            campaignId: row.campaignId ?? '',
            bloodGroup: row.bloodGroup,
            donationDate: row.donationDate.slice(0, 10),
            unitsDonated: String(row.unitsDonated ?? 1),
            donationCenter: row.donationCenter ?? '',
            hospitalName: row.hospitalName ?? '',
            city: row.city ?? '',
            state: row.state ?? '',
            notes: row.notes ?? '',
        });
        setPendingFile(null);
        setCrudMode('edit');
    };

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

    const submitDonationForm = async (event: FormEvent) => {
        event.preventDefault();
        if (crudMode === 'create' && !donationForm.userId) {
            showAlert('Select a donor first', 'error');
            return;
        }
        setCrudBusy(true);
        try {
            const body: Record<string, unknown> = {
                bloodGroup: donationForm.bloodGroup,
                donationDate: donationForm.donationDate,
                unitsDonated: donationForm.unitsDonated || undefined,
                donationCenter: donationForm.donationCenter || undefined,
                hospitalName: donationForm.hospitalName || undefined,
                city: donationForm.city || undefined,
                state: donationForm.state || undefined,
                notes: donationForm.notes || undefined,
                hospitalId: donationForm.donationType === 'hospital' ? donationForm.hospitalId || undefined : undefined,
                campaignId: donationForm.donationType === 'camp' ? donationForm.campaignId || undefined : undefined,
            };
            if (crudMode === 'create') {
                await adminApi.createDonation({ ...body, userId: donationForm.userId }, pendingFile);
                showAlert('Donation created successfully');
            } else if (editingDonationId) {
                await adminApi.updateDonation(editingDonationId, body);
                showAlert('Donation updated successfully');
            }
            setCrudMode(null);
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setCrudBusy(false);
        }
    };

    const removeDonation = async (donationId: string) => {
        const ok = await confirmAction('Delete donation record?');
        if (!ok) return;
        try {
            await adminApi.deleteDonation(donationId);
            showAlert('Donation deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDelete = async () => {
        const ok = await confirmAction(`Delete ${selection.selectedIds.length} donation(s)?`);
        if (!ok) return;
        try {
            for (const id of selection.selectedIds) await adminApi.deleteDonation(id);
            selection.clear();
            showAlert('Selected donations deleted');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkApprove = async () => {
        try {
            let approvedCount = 0;
            for (const id of selection.selectedIds) {
                const donation = items.find((item) => item.id === id);
                if (donation && ['PENDING', 'UNDER_REVIEW'].includes(donation.status)) {
                    await adminApi.reviewDonation(id, { status: 'APPROVED' });
                    approvedCount += 1;
                }
            }
            selection.clear();
            showAlert(
                approvedCount ? `${approvedCount} donation(s) approved and rewards credited` : 'No pending donations selected',
                approvedCount ? 'success' : 'warning',
            );
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkReject = async () => {
        const eligibleIds = selection.selectedIds.filter((id) => {
            const donation = items.find((item) => item.id === id);
            return donation && ['PENDING', 'UNDER_REVIEW'].includes(donation.status);
        });
        if (eligibleIds.length === 0) {
            showAlert('No pending donations selected', 'warning');
            return;
        }
        const reason = await promptReason('Rejection reason for selected donations');
        if (!reason) return;
        try {
            for (const id of eligibleIds) await adminApi.reviewDonation(id, { status: 'REJECTED', rejectionReason: reason });
            selection.clear();
            showAlert(`${eligibleIds.length} donation(s) rejected`);
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Blood Donations"
                subtitle="Review donor-submitted certificates, compare against connected sheets, and approve rewards"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                searchPlaceholder="Search by donor name, email, mobile, hospital or donation center"
                canClear={Boolean(search) || Boolean(statusFilter) || Boolean(donationDateFilter)}
                onCreate={openCreateDonation}
                createLabel="Add Donation"
                onClear={() => {
                    setSearch('');
                    setStatusFilter('');
                    setDonationDateFilter('');
                    load(1, pageSize, { search: '', status: '', donationDate: '' });
                }}
                filters={
                    <>
                        <input
                            type="date"
                            className="form-input w-full sm:w-auto min-w-[160px] shrink-0"
                            value={donationDateFilter}
                            onChange={(e) => {
                                setDonationDateFilter(e.target.value);
                                load(1, pageSize, { donationDate: e.target.value });
                            }}
                        />
                        <select
                            className="form-select w-full sm:w-auto min-w-[160px] shrink-0"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                load(1, pageSize, { status: e.target.value });
                            }}
                        >
                            <option value="">All statuses</option>
                            {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    </>
                }
            />

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

            <BulkActionsBar
                count={selection.selectedIds.length}
                onClear={selection.clear}
                onBulkDelete={bulkDelete}
                extra={
                    <>
                        <button type="button" className="btn btn-sm btn-success" onClick={bulkApprove}>
                            Approve pending
                        </button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={bulkReject}>
                            Reject pending
                        </button>
                    </>
                }
            />

            <AdminDataTable
                columns={[
                    {
                        key: 'donor',
                        label: 'Donor',
                        render: (row) => (
                            <div>
                                <div>{row.donor?.fullName ?? '—'}</div>
                                <div className="text-xs text-white-dark">{row.donor?.email ?? row.donor?.mobile ?? ''}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'donationDate',
                        label: 'Donation Date',
                        render: (row) => new Date(row.donationDate).toLocaleDateString(),
                    },
                    { key: 'bloodGroup', label: 'Group', render: (row) => row.bloodGroup.replace('_', ' ') },
                    { key: 'units', label: 'Units', render: (row) => row.unitsDonated },
                    {
                        key: 'location',
                        label: 'Location',
                        render: (row) => row.hospitalName || row.donationCenter || (row.isCampDonation ? 'Camp' : '—'),
                    },
                    {
                        key: 'reward',
                        label: 'Reward',
                        render: (row) => (row.rewardClaimed ? 'Credited' : '—'),
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
                            { label: 'Review', onClick: () => viewDonation(row.id) },
                            { label: 'Edit', onClick: () => openEditDonation(row) },
                            { label: 'Delete', onClick: () => removeDonation(row.id), danger: true },
                        ]}
                    />
                )}
            />

            <div className="panel mt-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div>
                        <h5 className="text-lg font-semibold dark:text-white-light">Connected Sheet Reconciliation</h5>
                        <p className="text-sm text-white-dark">
                            Import a CSV exported from a hospital or camp's connected donation sheet. Rows are automatically matched
                            against the donor's own submission (mobile/email + blood group + date) to verify the donation is genuine —
                            review anything left unmatched by hand.
                        </p>
                    </div>
                    <button type="button" className="btn btn-primary shrink-0" onClick={openCreateRecord}>
                        Add Sheet Record
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <FormField label="Hospital">
                        <select className="form-select" value={importHospitalId} onChange={(e) => { setImportHospitalId(e.target.value); if (e.target.value) setImportCampaignId(''); }}>
                            <option value="">None</option>
                            {hospitals.map((hospital) => (
                                <option key={hospital.id} value={hospital.id}>{hospital.name}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label="Campaign / Camp">
                        <select className="form-select" value={importCampaignId} onChange={(e) => { setImportCampaignId(e.target.value); if (e.target.value) setImportHospitalId(''); }}>
                            <option value="">None</option>
                            {campaigns.map((campaign) => (
                                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label="Upload CSV">
                        <input type="file" accept=".csv,text/csv" className="form-input" onChange={importSheet} />
                    </FormField>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <input
                        className="form-input w-64"
                        placeholder="Search donor name, mobile or email"
                        value={recordsSearch}
                        onChange={(e) => setRecordsSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') loadRecords(recordsUnmatchedOnly, recordsSearch);
                        }}
                    />
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => loadRecords(recordsUnmatchedOnly, recordsSearch)}>
                        Search
                    </button>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            className="form-checkbox"
                            checked={recordsUnmatchedOnly}
                            onChange={(e) => {
                                setRecordsUnmatchedOnly(e.target.checked);
                                loadRecords(e.target.checked, recordsSearch);
                            }}
                        />
                        Show unmatched only
                    </label>
                </div>

                <BulkActionsBar
                    count={recordSelection.selectedIds.length}
                    onClear={recordSelection.clear}
                    onBulkDelete={bulkDeleteRecords}
                />

                <div className="overflow-x-auto">
                    <table className="table-striped text-sm">
                        <thead>
                            <tr>
                                <th>
                                    <input
                                        type="checkbox"
                                        className="form-checkbox"
                                        checked={recordSelection.allSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = recordSelection.someSelected;
                                        }}
                                        onChange={recordSelection.toggleAll}
                                    />
                                </th>
                                <th>Donor Name</th>
                                <th>Mobile</th>
                                <th>Blood Group</th>
                                <th>Units</th>
                                <th>Date</th>
                                <th>Verification</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recordsLoading ? (
                                <tr><td colSpan={8}>Loading...</td></tr>
                            ) : records.length === 0 ? (
                                <tr><td colSpan={8}>No sheet records</td></tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                className="form-checkbox"
                                                checked={recordSelection.selectedSet.has(record.id)}
                                                onChange={() => recordSelection.toggle(record.id)}
                                            />
                                        </td>
                                        <td>{record.donorName || '—'}</td>
                                        <td>{record.donorMobile || '—'}</td>
                                        <td>{record.bloodGroup || '—'}</td>
                                        <td>{record.units ?? '—'}</td>
                                        <td>{record.donationDate ? new Date(record.donationDate).toLocaleDateString() : '—'}</td>
                                        <td>
                                            {record.matchedDonationId ? (
                                                <span className="badge bg-success">Verified genuine donation</span>
                                            ) : (
                                                <span className="badge bg-warning">Unmatched</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                {record.matchedDonationId ? (
                                                    <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => unmatchRecord(record.id)}>
                                                        Unmatch
                                                    </button>
                                                ) : (
                                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => openCandidates(record.id)}>
                                                        Find Match
                                                    </button>
                                                )}
                                                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => openEditRecord(record)}>
                                                    Edit
                                                </button>
                                                <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => removeRecord(record.id)}>
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AdminFormModal open={selectedDonation !== null} title="Donation Review" onClose={closeView} readOnly size="lg">
                {selectedDonation ? (
                    <>
                        <FormSection title="Overview">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-white-dark">Donor</div>
                                    <div>{selectedDonation.donor?.fullName ?? '—'}</div>
                                </div>
                                <div>
                                    <div className="text-white-dark">Blood Group</div>
                                    <div>{selectedDonation.bloodGroup.replace('_', ' ')}</div>
                                </div>
                                <div>
                                    <div className="text-white-dark">Units Donated</div>
                                    <div>{selectedDonation.unitsDonated}</div>
                                </div>
                                <div>
                                    <div className="text-white-dark">Donation Date</div>
                                    <div>{new Date(selectedDonation.donationDate).toLocaleDateString()}</div>
                                </div>
                                <div>
                                    <div className="text-white-dark">Created Date</div>
                                    <div>{new Date(selectedDonation.createdAt).toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="text-white-dark">Location</div>
                                    <div>{selectedDonation.hospitalName || selectedDonation.donationCenter || '—'}</div>
                                </div>
                                <div>
                                    <div className="text-white-dark">Status</div>
                                    <div><StatusBadge status={selectedDonation.status} /></div>
                                </div>
                                <div>
                                    <div className="text-white-dark">Reward</div>
                                    <div>{selectedDonation.rewardClaimed ? 'Credited to donor wallet' : 'Not yet credited'}</div>
                                </div>
                            </div>
                        </FormSection>

                        <FormSection title="Uploaded certificate / proof" className="mt-5">
                            {selectedDonation.proofImageUrl ? (
                                <img src={mediaUrl(selectedDonation.proofImageUrl)} alt="Donation proof" className="max-h-64 rounded object-contain" />
                            ) : (
                                <span className="text-white-dark">No proof uploaded</span>
                            )}
                        </FormSection>

                        {selectedDonation.rejectionReason ? (
                            <FormSection title="Rejection reason" className="mt-5">
                                <p className="text-sm text-danger">{selectedDonation.rejectionReason}</p>
                            </FormSection>
                        ) : null}

                        {canReview ? (
                            <FormSection title="Review" className="mt-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField label="Rejection reason" hint="Required only when rejecting">
                                        <input
                                            className="form-input"
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                        />
                                    </FormField>
                                </div>
                                <div className="flex items-center gap-3 mt-3">
                                    <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={approve}>
                                        {busy ? 'Working...' : 'Approve & Credit Reward'}
                                    </button>
                                    <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={reject}>
                                        {busy ? 'Working...' : 'Reject'}
                                    </button>
                                </div>
                            </FormSection>
                        ) : null}
                    </>
                ) : null}
            </AdminFormModal>

            <AdminFormModal
                open={crudMode !== null}
                title={crudMode === 'create' ? 'Add Donation' : 'Edit Donation'}
                onClose={() => setCrudMode(null)}
                onSubmit={submitDonationForm}
                busy={crudBusy}
                size="lg"
            >
                <FormSection title="Donation details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {crudMode === 'create' ? (
                            <FormField label="Donor" required className="md:col-span-2" hint="Search by name, email or mobile">
                                {donationForm.userId ? (
                                    <div className="flex items-center justify-between rounded border border-[#ebedf2] p-2 dark:border-[#191e3a]">
                                        <span>{donationForm.donorLabel}</span>
                                        <button
                                            type="button"
                                            className="btn btn-outline-dark btn-sm"
                                            onClick={() => setDonationForm({ ...donationForm, userId: '', donorLabel: '' })}
                                        >
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
                                                                setDonationForm({
                                                                    ...donationForm,
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
                                        checked={donationForm.donationType === 'hospital'}
                                        onChange={() => setDonationForm({ ...donationForm, donationType: 'hospital', campaignId: '' })}
                                    />
                                    Hospital
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={donationForm.donationType === 'camp'}
                                        onChange={() => setDonationForm({ ...donationForm, donationType: 'camp', hospitalId: '' })}
                                    />
                                    Camp
                                </label>
                            </div>
                        </FormField>
                        {donationForm.donationType === 'hospital' ? (
                            <FormField label="Hospital">
                                <select
                                    className="form-select"
                                    value={donationForm.hospitalId}
                                    onChange={(e) => setDonationForm({ ...donationForm, hospitalId: e.target.value })}
                                >
                                    <option value="">None</option>
                                    {hospitals.map((hospital) => (
                                        <option key={hospital.id} value={hospital.id}>
                                            {hospital.name}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                        ) : (
                            <FormField label="Camp / Campaign">
                                <select
                                    className="form-select"
                                    value={donationForm.campaignId}
                                    onChange={(e) => setDonationForm({ ...donationForm, campaignId: e.target.value })}
                                >
                                    <option value="">None</option>
                                    {campaigns.map((campaign) => (
                                        <option key={campaign.id} value={campaign.id}>
                                            {campaign.name}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                        )}
                        <FormField label="Blood Group" required>
                            <select
                                className="form-select"
                                required
                                value={donationForm.bloodGroup}
                                onChange={(e) => setDonationForm({ ...donationForm, bloodGroup: e.target.value })}
                            >
                                <option value="">Select blood group</option>
                                {BLOOD_GROUPS.map((group) => (
                                    <option key={group} value={group}>
                                        {group.replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Donation Date" required>
                            <input
                                className="form-input"
                                type="date"
                                required
                                value={donationForm.donationDate}
                                onChange={(e) => setDonationForm({ ...donationForm, donationDate: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Units Donated">
                            <input
                                className="form-input"
                                type="number"
                                min={0.5}
                                step={0.5}
                                value={donationForm.unitsDonated}
                                onChange={(e) => setDonationForm({ ...donationForm, unitsDonated: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Donation Center Name">
                            <input
                                className="form-input"
                                value={donationForm.donationCenter}
                                onChange={(e) => setDonationForm({ ...donationForm, donationCenter: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Hospital Name" hint="Free text, shown even if not a registered hospital">
                            <input
                                className="form-input"
                                value={donationForm.hospitalName}
                                onChange={(e) => setDonationForm({ ...donationForm, hospitalName: e.target.value })}
                            />
                        </FormField>
                        <FormField label="City">
                            <input
                                className="form-input"
                                value={donationForm.city}
                                onChange={(e) => setDonationForm({ ...donationForm, city: e.target.value })}
                            />
                        </FormField>
                        <FormField label="State">
                            <input
                                className="form-input"
                                value={donationForm.state}
                                onChange={(e) => setDonationForm({ ...donationForm, state: e.target.value })}
                            />
                        </FormField>
                        {crudMode === 'create' ? (
                            <FormField label="Certificate / Proof Image" className="md:col-span-2" hint="Optional at creation time">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="form-input"
                                    onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                                />
                            </FormField>
                        ) : null}
                        <FormField label="Notes" className="md:col-span-2">
                            <textarea
                                className="form-textarea"
                                value={donationForm.notes}
                                onChange={(e) => setDonationForm({ ...donationForm, notes: e.target.value })}
                            />
                        </FormField>
                    </div>
                </FormSection>
            </AdminFormModal>

            <AdminFormModal
                open={recordMode !== null}
                title={recordMode === 'create' ? 'Add Sheet Record' : 'Edit Sheet Record'}
                onClose={() => setRecordMode(null)}
                onSubmit={submitRecordForm}
                busy={recordBusy}
            >
                <FormSection title="Sheet record details" className="md:col-span-2" description="Saved automatically as a verified match if it lines up with a genuine donation submission">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Recorded At">
                            <div className="flex items-center gap-4 h-[38px]">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={recordForm.donationType === 'hospital'}
                                        onChange={() => setRecordForm({ ...recordForm, donationType: 'hospital', campaignId: '' })}
                                    />
                                    Hospital
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={recordForm.donationType === 'camp'}
                                        onChange={() => setRecordForm({ ...recordForm, donationType: 'camp', hospitalId: '' })}
                                    />
                                    Camp
                                </label>
                            </div>
                        </FormField>
                        {recordForm.donationType === 'hospital' ? (
                            <FormField label="Hospital">
                                <select className="form-select" value={recordForm.hospitalId} onChange={(e) => setRecordForm({ ...recordForm, hospitalId: e.target.value })}>
                                    <option value="">None</option>
                                    {hospitals.map((hospital) => (
                                        <option key={hospital.id} value={hospital.id}>{hospital.name}</option>
                                    ))}
                                </select>
                            </FormField>
                        ) : (
                            <FormField label="Camp / Campaign">
                                <select className="form-select" value={recordForm.campaignId} onChange={(e) => setRecordForm({ ...recordForm, campaignId: e.target.value })}>
                                    <option value="">None</option>
                                    {campaigns.map((campaign) => (
                                        <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                                    ))}
                                </select>
                            </FormField>
                        )}
                        <FormField label="Donor Name">
                            <input className="form-input" value={recordForm.donorName} onChange={(e) => setRecordForm({ ...recordForm, donorName: e.target.value })} />
                        </FormField>
                        <FormField label="Donor Mobile" hint="Used to match against the donor's account">
                            <input className="form-input" value={recordForm.donorMobile} onChange={(e) => setRecordForm({ ...recordForm, donorMobile: e.target.value })} />
                        </FormField>
                        <FormField label="Donor Email">
                            <input className="form-input" type="email" value={recordForm.donorEmail} onChange={(e) => setRecordForm({ ...recordForm, donorEmail: e.target.value })} />
                        </FormField>
                        <FormField label="Blood Group" hint="e.g. O+ or O_POSITIVE">
                            <input className="form-input" value={recordForm.bloodGroup} onChange={(e) => setRecordForm({ ...recordForm, bloodGroup: e.target.value })} />
                        </FormField>
                        <FormField label="Units">
                            <input className="form-input" type="number" min={0} step={0.5} value={recordForm.units} onChange={(e) => setRecordForm({ ...recordForm, units: e.target.value })} />
                        </FormField>
                        <FormField label="Donation Date">
                            <input className="form-input" type="date" value={recordForm.donationDate} onChange={(e) => setRecordForm({ ...recordForm, donationDate: e.target.value })} />
                        </FormField>
                    </div>
                </FormSection>
            </AdminFormModal>

            <AdminFormModal open={candidatesRecordId !== null} title="Genuine Donation Matches" onClose={() => setCandidatesRecordId(null)} readOnly>
                <FormSection title="Candidates" description="Pending donation submissions from this donor that match this sheet row">
                    {candidatesLoading ? (
                        <p className="text-sm text-white-dark">Loading...</p>
                    ) : candidates.length === 0 ? (
                        <p className="text-sm text-white-dark">
                            No matching pending donation was found for this donor. Verify the mobile/email, blood group and date on the
                            sheet row, or ask the donor to submit their donation first.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {candidates.map((candidate) => (
                                <li key={candidate.id} className="flex items-center justify-between rounded border border-[#ebedf2] p-3 dark:border-[#191e3a]">
                                    <div className="text-sm">
                                        <div className="font-semibold">{candidate.donor?.fullName ?? '—'}</div>
                                        <div className="text-white-dark">
                                            {candidate.bloodGroup?.replace('_', ' ')} · {candidate.unitsDonated} unit(s) ·{' '}
                                            {new Date(candidate.donationDate).toLocaleDateString()} · <StatusBadge status={candidate.status} />
                                        </div>
                                    </div>
                                    <button type="button" className="btn btn-success btn-sm" onClick={() => selectCandidate(candidate.id)}>
                                        Confirm Match
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
