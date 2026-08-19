import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage, mediaUrl } from '../../services/api';
import { AdminDataTable } from '../../components/Admin/AdminTable';
import { StatusBadge } from '../../components/Admin/FormPrimitives';
import { showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';

export default function CampaignDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [campaign, setCampaign] = useState<any | null>(null);
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

    const loadCampaign = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const data = (await adminApi.getCampaign(id)) as any;
            setCampaign(data);
            dispatch(setPageTitle(data.name || 'Campaign Detail'));
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
            const data = await adminApi.listAppointments({ campaignId: id, page, limit: size });
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
            const data = await adminApi.listDonations({ campaignId: id, page, limit: size });
            setDonations(data.items ?? []);
            setDonationsMeta(data.meta);
        } catch (err) {
            showAlert(getErrorMessage(err, 'Failed to load donations'), 'error');
        } finally {
            setDonationsLoading(false);
        }
    };

    useEffect(() => {
        loadCampaign();
        loadAppointments(1, appointmentsPageSize);
        loadDonations(1, donationsPageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const infoCards = useMemo(() => {
        if (!campaign) return [];
        return [
            { label: 'Type', value: campaign.type },
            { label: 'Location', value: `${campaign.city}, ${campaign.state}` },
            { label: 'Hospital', value: campaign.hospital?.name || '—' },
            { label: 'Dates', value: `${campaign.startsAt?.slice(0, 10)} → ${campaign.endsAt?.slice(0, 10)}` },
            { label: 'Units Collected', value: `${campaign.unitsCollected}${campaign.targetUnits ? ` / ${campaign.targetUnits}` : ''}` },
            { label: 'Status', value: campaign.status },
            { label: 'Appointments', value: appointmentsMeta.total },
            { label: 'Donations', value: donationsMeta.total },
        ];
    }, [campaign, appointmentsMeta.total, donationsMeta.total]);

    if (loading) {
        return <div className="panel">Loading campaign...</div>;
    }

    if (!campaign) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'Campaign not found'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/admin/campaigns')}>
                    Back to campaigns
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-start gap-3">
                    <Link to="/admin/campaigns" className="btn btn-outline-primary p-2 mt-0.5" aria-label="Back">
                        <IconArrowLeft className="w-4.5 h-4.5" />
                    </Link>
                    <div className="flex items-center gap-3">
                        {campaign.bannerUrl ? (
                            <img src={mediaUrl(campaign.bannerUrl)} alt={campaign.name} className="h-12 w-20 rounded object-cover" />
                        ) : null}
                        <div>
                            <h2 className="text-xl font-semibold dark:text-white-light">{campaign.name}</h2>
                            <p className="text-white-dark text-sm mt-1">{campaign.venueName || campaign.address}</p>
                        </div>
                    </div>
                </div>
                <StatusBadge status={campaign.status} />
            </div>

            <div className="panel mb-5">
                <h5 className="font-semibold text-lg mb-4">Campaign information</h5>
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
                <h5 className="font-semibold text-lg">Appointments at this Campaign</h5>
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
                emptyText="No appointments booked at this campaign"
            />

            <div className="mb-4 mt-6">
                <h5 className="font-semibold text-lg">Donations at this Campaign</h5>
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
                emptyText="No donations recorded at this campaign"
            />
        </div>
    );
}
