import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { AdminDataTable } from '../../components/Admin/AdminTable';
import { StatusBadge } from '../../components/Admin/FormPrimitives';
import { showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';

export default function HospitalDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [hospital, setHospital] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [appointments, setAppointments] = useState<any[]>([]);
    const [appointmentsMeta, setAppointmentsMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [appointmentsPageSize, setAppointmentsPageSize] = useState(10);
    const [appointmentsLoading, setAppointmentsLoading] = useState(false);

    const [donations, setDonations] = useState<any[]>([]);
    const [donationsMeta, setDonationsMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [donationsPageSize, setDonationsPageSize] = useState(10);
    const [donationsLoading, setDonationsLoading] = useState(false);

    const loadHospital = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const data = (await adminApi.getHospital(id)) as any;
            setHospital(data);
            dispatch(setPageTitle(data.name || 'Hospital Detail'));
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadAppointments = async (page = 1, size = appointmentsPageSize) => {
        if (!id) return;
        setAppointmentsLoading(true);
        try {
            const data = await adminApi.listAppointments({ hospitalId: id, page, limit: size });
            setAppointments(data.items ?? []);
            setAppointmentsMeta(data.meta);
        } catch (err) {
            showAlert(getErrorMessage(err, 'Failed to load appointments'), 'error');
        } finally {
            setAppointmentsLoading(false);
        }
    };

    const loadDonations = async (page = 1, size = donationsPageSize) => {
        if (!id) return;
        setDonationsLoading(true);
        try {
            const data = await adminApi.listDonations({ hospitalId: id, page, limit: size });
            setDonations(data.items ?? []);
            setDonationsMeta(data.meta);
        } catch (err) {
            showAlert(getErrorMessage(err, 'Failed to load donations'), 'error');
        } finally {
            setDonationsLoading(false);
        }
    };

    useEffect(() => {
        loadHospital();
        loadAppointments(1, appointmentsPageSize);
        loadDonations(1, donationsPageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const infoCards = useMemo(() => {
        if (!hospital) return [];
        return [
            { label: 'Registration No.', value: hospital.registrationNo || '—' },
            { label: 'Location', value: `${hospital.city}, ${hospital.state}` },
            { label: 'Contact', value: hospital.contactMobile || hospital.contactEmail || '—' },
            { label: 'Status', value: hospital.isActive ? 'ACTIVE' : 'INACTIVE' },
            { label: 'Appointments', value: appointmentsMeta.total },
            { label: 'Donations', value: donationsMeta.total },
        ];
    }, [hospital, appointmentsMeta.total, donationsMeta.total]);

    if (loading) {
        return <div className="panel">Loading hospital...</div>;
    }

    if (!hospital) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'Hospital not found'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/admin/hospitals')}>
                    Back to hospitals
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-start gap-3">
                    <Link to="/admin/hospitals" className="btn btn-outline-primary p-2 mt-0.5" aria-label="Back">
                        <IconArrowLeft className="w-4.5 h-4.5" />
                    </Link>
                    <div>
                        <h2 className="text-xl font-semibold dark:text-white-light">{hospital.name}</h2>
                        <p className="text-white-dark text-sm mt-1">{hospital.address}</p>
                    </div>
                </div>
                <StatusBadge status={hospital.isActive ? 'ACTIVE' : 'INACTIVE'} />
            </div>

            <div className="panel mb-5">
                <h5 className="font-semibold text-lg mb-4">Hospital information</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {infoCards.map((card) => (
                        <div key={card.label} className="rounded border border-[#ebedf2] dark:border-[#191e3a] p-4">
                            <div className="text-xs uppercase tracking-wide text-white-dark mb-1">{card.label}</div>
                            <div className="font-semibold break-all">{card.label === 'Status' ? <StatusBadge status={String(card.value)} /> : card.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-4">
                <h5 className="font-semibold text-lg">Appointments at this Hospital</h5>
            </div>
            <AdminDataTable
                selectable={false}
                columns={[
                    {
                        key: 'donor',
                        label: 'Donor',
                        render: (row) => (
                            <div>
                                <div>{row.donor?.fullName ?? '—'}</div>
                                <div className="text-xs text-white-dark">{row.donor?.mobile ?? row.donor?.email ?? ''}</div>
                            </div>
                        ),
                    },
                    { key: 'bloodGroup', label: 'Blood Group', render: (row) => row.bloodGroup.replace('_', ' ') },
                    { key: 'appointmentDate', label: 'Date', render: (row) => new Date(row.appointmentDate).toLocaleDateString() },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
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
                emptyText="No appointments booked at this hospital"
            />

            <div className="mb-4 mt-6">
                <h5 className="font-semibold text-lg">Donations at this Hospital</h5>
            </div>
            <AdminDataTable
                selectable={false}
                columns={[
                    {
                        key: 'donor',
                        label: 'Donor',
                        render: (row) => (
                            <div>
                                <div>{row.donor?.fullName ?? '—'}</div>
                                <div className="text-xs text-white-dark">{row.donor?.mobile ?? row.donor?.email ?? ''}</div>
                            </div>
                        ),
                    },
                    { key: 'bloodGroup', label: 'Blood Group', render: (row) => row.bloodGroup.replace('_', ' ') },
                    { key: 'donationDate', label: 'Date', render: (row) => new Date(row.donationDate).toLocaleDateString() },
                    { key: 'units', label: 'Units', render: (row) => row.unitsDonated },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                ]}
                rows={donations}
                loading={donationsLoading}
                page={donationsMeta.page}
                totalPages={donationsMeta.totalPages}
                total={donationsMeta.total}
                pageSize={donationsPageSize}
                onPageChange={(page) => loadDonations(page, donationsPageSize)}
                onPageSizeChange={(size) => {
                    setDonationsPageSize(size);
                    loadDonations(1, size);
                }}
                emptyText="No donations recorded at this hospital"
            />
        </div>
    );
}
