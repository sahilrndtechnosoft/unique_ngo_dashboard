import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage, mediaUrl } from '../../services/api';
import { AdminDataTable } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';
import IconPlus from '../../components/Icon/IconPlus';

const APPOINTMENT_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
const BLOOD_GROUPS = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'];

type AppointmentMode = 'create' | 'edit';

const emptyAppointmentForm = {
    donationType: 'hospital' as 'hospital' | 'camp',
    hospitalId: '',
    campaignId: '',
    bloodGroup: '',
    appointmentDate: '',
    timeSlot: '',
    notes: '',
    status: 'PENDING',
    cancelReason: '',
};

export default function UserDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [user, setUser] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [appointments, setAppointments] = useState<any[]>([]);
    const [appointmentsMeta, setAppointmentsMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [appointmentsPageSize, setAppointmentsPageSize] = useState(10);
    const [appointmentsStatusFilter, setAppointmentsStatusFilter] = useState('');
    const [appointmentsLoading, setAppointmentsLoading] = useState(false);

    const [hospitals, setHospitals] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [appointmentMode, setAppointmentMode] = useState<AppointmentMode | null>(null);
    const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
    const [appointmentForm, setAppointmentForm] = useState(emptyAppointmentForm);
    const [appointmentBusy, setAppointmentBusy] = useState(false);

    const loadUser = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const data = (await adminApi.getUser(id)) as any;
            setUser(data);
            dispatch(setPageTitle(data.fullName || 'User Detail'));
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadAppointments = async (page = 1, size = appointmentsPageSize, status?: string) => {
        if (!id) return;
        const nextStatus = status ?? appointmentsStatusFilter;
        setAppointmentsLoading(true);
        try {
            const data = await adminApi.listAppointments({
                userId: id,
                page,
                limit: size,
                status: nextStatus || undefined,
            });
            setAppointments(data.items ?? []);
            setAppointmentsMeta(data.meta);
        } catch (err) {
            showAlert(getErrorMessage(err, 'Failed to load appointments'), 'error');
        } finally {
            setAppointmentsLoading(false);
        }
    };

    useEffect(() => {
        loadUser();
        loadAppointments(1, appointmentsPageSize);
        adminApi.listHospitals({ page: 1, limit: 100, isActive: true }).then((data) => setHospitals(data.items));
        adminApi.listCampaigns({ page: 1, limit: 100 }).then((data) => setCampaigns(data.items));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const openCreateAppointment = () => {
        setEditingAppointmentId(null);
        setAppointmentForm(emptyAppointmentForm);
        setAppointmentMode('create');
    };

    const openEditAppointment = (appointment: any) => {
        setEditingAppointmentId(appointment.id);
        setAppointmentForm({
            donationType: appointment.campaignId ? 'camp' : 'hospital',
            hospitalId: appointment.hospitalId ?? '',
            campaignId: appointment.campaignId ?? '',
            bloodGroup: appointment.bloodGroup,
            appointmentDate: appointment.appointmentDate.slice(0, 10),
            timeSlot: appointment.timeSlot ?? '',
            notes: appointment.notes ?? '',
            status: appointment.status,
            cancelReason: appointment.cancelReason ?? '',
        });
        setAppointmentMode('edit');
    };

    const submitAppointment = async (event: FormEvent) => {
        event.preventDefault();
        if (!id) return;
        setAppointmentBusy(true);
        try {
            const body: Record<string, unknown> = {
                bloodGroup: appointmentForm.bloodGroup,
                appointmentDate: appointmentForm.appointmentDate,
                timeSlot: appointmentForm.timeSlot || undefined,
                notes: appointmentForm.notes || undefined,
                hospitalId: appointmentForm.donationType === 'hospital' ? appointmentForm.hospitalId || undefined : undefined,
                campaignId: appointmentForm.donationType === 'camp' ? appointmentForm.campaignId || undefined : undefined,
            };
            if (appointmentMode === 'create') {
                await adminApi.createAppointment({ ...body, userId: id });
                showAlert('Appointment created successfully');
            } else if (editingAppointmentId) {
                await adminApi.updateAppointment(editingAppointmentId, {
                    ...body,
                    status: appointmentForm.status,
                    cancelReason: appointmentForm.cancelReason || undefined,
                });
                showAlert('Appointment updated successfully');
            }
            setAppointmentMode(null);
            await loadAppointments(appointmentsMeta.page, appointmentsPageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setAppointmentBusy(false);
        }
    };

    const deleteAppointment = async (appointmentId: string) => {
        const ok = await confirmAction('Delete appointment?');
        if (!ok) return;
        try {
            await adminApi.deleteAppointment(appointmentId);
            showAlert('Appointment deleted successfully');
            await loadAppointments(appointmentsMeta.page, appointmentsPageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const infoCards = useMemo(() => {
        if (!user) return [];
        return [
            { label: 'Email', value: user.email || '—' },
            { label: 'Mobile', value: user.mobile || '—' },
            { label: 'Account type', value: user.role },
            { label: 'RBAC role', value: user.rbacRole?.name || '—' },
            { label: 'Status', value: user.status },
            { label: 'Blood Group', value: user.bloodGroup ? user.bloodGroup.replace('_', ' ') : '—' },
        ];
    }, [user]);

    if (loading) {
        return <div className="panel">Loading user...</div>;
    }

    if (!user) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'User not found'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/admin/users')}>
                    Back to users
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-start gap-3">
                    <Link to="/admin/users" className="btn btn-outline-primary p-2 mt-0.5" aria-label="Back">
                        <IconArrowLeft className="w-4.5 h-4.5" />
                    </Link>
                    <div className="flex items-center gap-3">
                        {user.profilePicture ? (
                            <img src={mediaUrl(user.profilePicture)} alt={user.fullName} className="h-12 w-12 rounded-full object-cover" />
                        ) : null}
                        <div>
                            <h2 className="text-xl font-semibold dark:text-white-light">{user.fullName}</h2>
                            <p className="text-white-dark text-sm mt-1">User detail and blood donation appointments</p>
                        </div>
                    </div>
                </div>
                <StatusBadge status={user.status} />
            </div>

            <div className="panel mb-5">
                <h5 className="font-semibold text-lg mb-4">User information</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {infoCards.map((card) => (
                        <div key={card.label} className="rounded border border-[#ebedf2] dark:border-[#191e3a] p-4">
                            <div className="text-xs uppercase tracking-wide text-white-dark mb-1">{card.label}</div>
                            <div className="font-semibold break-all">
                                {card.label === 'Status' ? <StatusBadge status={String(card.value)} /> : card.value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h5 className="font-semibold text-lg">Blood Donation Appointments</h5>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        className="form-select w-44"
                        value={appointmentsStatusFilter}
                        onChange={(e) => setAppointmentsStatusFilter(e.target.value)}
                    >
                        <option value="">All statuses</option>
                        {APPOINTMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </select>
                    <button type="button" className="btn btn-primary" onClick={() => loadAppointments(1, appointmentsPageSize)}>
                        Filter
                    </button>
                    <button
                        type="button"
                        className="btn btn-outline-dark"
                        onClick={() => {
                            setAppointmentsStatusFilter('');
                            loadAppointments(1, appointmentsPageSize, '');
                        }}
                    >
                        Clear
                    </button>
                    <button type="button" className="btn btn-primary" onClick={openCreateAppointment}>
                        <IconPlus className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" />
                        Add Appointment
                    </button>
                </div>
            </div>

            <AdminDataTable
                selectable={false}
                columns={[
                    {
                        key: 'appointmentDate',
                        label: 'Appointment Date',
                        render: (row) => (
                            <div>
                                <div className="font-semibold">{new Date(row.appointmentDate).toLocaleDateString()}</div>
                                <div className="text-xs text-white-dark">{row.timeSlot || '—'}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'createdAt',
                        label: 'Created Date',
                        render: (row) => new Date(row.createdAt).toLocaleString(),
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
                        render: (row) => <StatusBadge status={row.status} />,
                    },
                ]}
                rows={appointments}
                loading={appointmentsLoading}
                page={appointmentsMeta.page}
                totalPages={appointmentsMeta.totalPages}
                total={appointmentsMeta.total}
                pageSize={appointmentsPageSize}
                onPageChange={(page) => loadAppointments(page, appointmentsPageSize)}
                onPageSizeChange={(size) => {
                    setAppointmentsPageSize(size);
                    loadAppointments(1, size);
                }}
                actions={(row) => (
                    <RowActionsMenu
                        actions={[
                            { label: 'Edit', onClick: () => openEditAppointment(row) },
                            { label: 'Delete', onClick: () => deleteAppointment(row.id), danger: true },
                        ]}
                    />
                )}
                emptyText="No blood donation appointments booked by this user"
            />

            <AdminFormModal
                open={appointmentMode !== null}
                title={appointmentMode === 'create' ? 'Add Appointment' : 'Edit Appointment'}
                onClose={() => setAppointmentMode(null)}
                onSubmit={submitAppointment}
                busy={appointmentBusy}
            >
                <FormSection title="Appointment details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Donated At">
                            <div className="flex items-center gap-4 h-[38px]">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={appointmentForm.donationType === 'hospital'}
                                        onChange={() => setAppointmentForm({ ...appointmentForm, donationType: 'hospital', campaignId: '' })}
                                    />
                                    Hospital
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={appointmentForm.donationType === 'camp'}
                                        onChange={() => setAppointmentForm({ ...appointmentForm, donationType: 'camp', hospitalId: '' })}
                                    />
                                    Camp
                                </label>
                            </div>
                        </FormField>
                        {appointmentForm.donationType === 'hospital' ? (
                            <FormField label="Hospital">
                                <select
                                    className="form-select"
                                    value={appointmentForm.hospitalId}
                                    onChange={(e) => setAppointmentForm({ ...appointmentForm, hospitalId: e.target.value })}
                                >
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
                                <select
                                    className="form-select"
                                    value={appointmentForm.campaignId}
                                    onChange={(e) => setAppointmentForm({ ...appointmentForm, campaignId: e.target.value })}
                                >
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
                            <select
                                className="form-select"
                                required
                                value={appointmentForm.bloodGroup}
                                onChange={(e) => setAppointmentForm({ ...appointmentForm, bloodGroup: e.target.value })}
                            >
                                <option value="">Select blood group</option>
                                {BLOOD_GROUPS.map((group) => (
                                    <option key={group} value={group}>
                                        {group.replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Appointment Date" required>
                            <input
                                className="form-input"
                                type="date"
                                required
                                value={appointmentForm.appointmentDate}
                                onChange={(e) => setAppointmentForm({ ...appointmentForm, appointmentDate: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Time Slot">
                            <input
                                className="form-input"
                                value={appointmentForm.timeSlot}
                                onChange={(e) => setAppointmentForm({ ...appointmentForm, timeSlot: e.target.value })}
                            />
                        </FormField>
                        {appointmentMode === 'edit' ? (
                            <FormField label="Status">
                                <select
                                    className="form-select"
                                    value={appointmentForm.status}
                                    onChange={(e) => setAppointmentForm({ ...appointmentForm, status: e.target.value })}
                                >
                                    {APPOINTMENT_STATUSES.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                        ) : null}
                        {appointmentMode === 'edit' && appointmentForm.status === 'CANCELLED' ? (
                            <FormField label="Cancel Reason" className="md:col-span-2">
                                <input
                                    className="form-input"
                                    value={appointmentForm.cancelReason}
                                    onChange={(e) => setAppointmentForm({ ...appointmentForm, cancelReason: e.target.value })}
                                />
                            </FormField>
                        ) : null}
                        <FormField label="Notes" className="md:col-span-2">
                            <textarea
                                className="form-textarea"
                                value={appointmentForm.notes}
                                onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                            />
                        </FormField>
                    </div>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
