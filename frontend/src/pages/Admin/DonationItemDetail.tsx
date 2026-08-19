import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage, mediaUrl } from '../../services/api';
import { AdminDataTable } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';

export default function DonationItemDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [item, setItem] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectNote, setRejectNote] = useState('');

    const [requests, setRequests] = useState<any[]>([]);
    const [requestsMeta, setRequestsMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [requestsPageSize, setRequestsPageSize] = useState(10);
    const [requestsLoading, setRequestsLoading] = useState(false);

    const [transfers, setTransfers] = useState<any[]>([]);
    const [transfersLoading, setTransfersLoading] = useState(false);

    const loadItem = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const data = (await adminApi.getDonationItem(id)) as any;
            setItem(data);
            dispatch(setPageTitle(data.title || 'Donation Item Detail'));
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadRequests = async (page = 1, size = requestsPageSize) => {
        if (!id) return;
        setRequestsLoading(true);
        try {
            const data = await adminApi.listDonationItemRequests({ donationItemId: id, page, limit: size });
            setRequests(data.items ?? []);
            setRequestsMeta(data.meta);
        } catch (err) {
            showAlert(getErrorMessage(err, 'Failed to load requests'), 'error');
        } finally {
            setRequestsLoading(false);
        }
    };

    const loadTransfers = async () => {
        if (!id) return;
        setTransfersLoading(true);
        try {
            const data = await adminApi.listDonationTransfers({ donationItemId: id, page: 1, limit: 10 });
            setTransfers(data.items ?? []);
        } catch (err) {
            showAlert(getErrorMessage(err, 'Failed to load transfers'), 'error');
        } finally {
            setTransfersLoading(false);
        }
    };

    useEffect(() => {
        loadItem();
        loadRequests(1, requestsPageSize);
        loadTransfers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const verify = async () => {
        if (!id) return;
        setBusy(true);
        try {
            await adminApi.verifyDonationItem(id);
            showAlert('Donation item approved successfully');
            await loadItem();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const submitReject = async (event: FormEvent) => {
        event.preventDefault();
        if (!id) return;
        setBusy(true);
        try {
            await adminApi.rejectDonationItem(id, rejectNote);
            showAlert('Donation item rejected');
            setRejectOpen(false);
            setRejectNote('');
            await loadItem();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!id) return;
        const ok = await confirmAction('Delete this donation item?');
        if (!ok) return;
        try {
            await adminApi.deleteDonationItem(id);
            showAlert('Donation item deleted successfully');
            navigate('/admin/donation-items');
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const infoCards = useMemo(() => {
        if (!item) return [];
        return [
            { label: 'Category', value: (item.category ?? '—').toString().replace('_', ' ') },
            { label: 'Condition', value: item.condition },
            { label: 'Quantity', value: item.quantity },
            { label: 'Status', value: item.status },
            { label: 'Pickup Location', value: `${item.pickupCity}, ${item.pickupState}` },
            { label: 'Pickup Only', value: item.isPickupOnly ? 'Yes' : 'No' },
            { label: 'Donor', value: item.donor?.fullName ?? '—' },
            { label: 'Donor Mobile', value: item.donor?.mobileMasked ?? '—' },
            { label: 'Review Status', value: item.isVerified ? 'VERIFIED' : 'PENDING REVIEW' },
            { label: 'Listed On', value: new Date(item.createdAt).toLocaleString() },
        ];
    }, [item]);

    if (loading) {
        return <div className="panel">Loading donation item...</div>;
    }

    if (!item) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'Donation item not found'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/admin/donation-items')}>
                    Back to donation items
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div className="flex items-start gap-3">
                    <Link to="/admin/donation-items" className="btn btn-outline-primary p-2 mt-0.5" aria-label="Back">
                        <IconArrowLeft className="w-4.5 h-4.5" />
                    </Link>
                    <div>
                        <h2 className="text-xl font-semibold dark:text-white-light">{item.title}</h2>
                        <p className="text-white-dark text-sm mt-1">{item.description}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    {!item.isVerified ? (
                        <>
                            <button type="button" className="btn btn-success" disabled={busy} onClick={verify}>
                                Approve
                            </button>
                            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setRejectOpen(true)}>
                                Reject
                            </button>
                        </>
                    ) : null}
                    <button type="button" className="btn btn-outline-danger" onClick={remove}>
                        Delete
                    </button>
                </div>
            </div>

            {item.adminNote ? (
                <div className="mb-5 rounded bg-danger-light p-3 text-danger">
                    <span className="font-semibold">Admin note:</span> {item.adminNote}
                </div>
            ) : null}

            {item.images?.length ? (
                <div className="panel mb-5">
                    <h5 className="font-semibold text-lg mb-4">Photos</h5>
                    <div className="flex flex-wrap gap-3">
                        {item.images.map((image: any) => (
                            <img key={image.id} src={mediaUrl(image.url)} alt="" className="h-28 w-28 rounded object-cover border border-[#ebedf2] dark:border-[#191e3a]" />
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="panel mb-5">
                <h5 className="font-semibold text-lg mb-4">Item information</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {infoCards.map((card) => (
                        <div key={card.label} className="rounded border border-[#ebedf2] dark:border-[#191e3a] p-4">
                            <div className="text-xs uppercase tracking-wide text-white-dark mb-1">{card.label}</div>
                            <div className="font-semibold break-all">{card.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {transfers.length > 0 ? (
                <div className="panel mb-5">
                    <h5 className="font-semibold text-lg mb-4">Handover</h5>
                    {transfersLoading ? (
                        <p>Loading...</p>
                    ) : (
                        transfers.map((transfer: any) => (
                            <div key={transfer.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-white-dark mb-1">Recipient</div>
                                    <div className="font-semibold">{transfer.recipient?.fullName ?? '—'}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-white-dark mb-1">Donor Confirmed</div>
                                    <div className="font-semibold">{transfer.donorConfirmed ? 'Yes' : 'No'}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-white-dark mb-1">Recipient Confirmed</div>
                                    <div className="font-semibold">{transfer.recipientConfirmed ? 'Yes' : 'No'}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-white-dark mb-1">Transfer Date</div>
                                    <div className="font-semibold">{transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString() : '—'}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : null}

            <div className="mb-4">
                <h5 className="font-semibold text-lg">Requests for this Item</h5>
            </div>

            <AdminDataTable
                selectable={false}
                columns={[
                    {
                        key: 'requester',
                        label: 'Requester',
                        render: (row) => (
                            <div>
                                <div className="font-semibold">{row.requester?.fullName ?? '—'}</div>
                                <div className="text-xs text-white-dark">{row.requester?.mobile ?? '—'}</div>
                            </div>
                        ),
                    },
                    { key: 'purpose', label: 'Purpose', render: (row) => row.purpose },
                    { key: 'quantityNeeded', label: 'Qty', render: (row) => row.quantityNeeded },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    {
                        key: 'createdAt',
                        label: 'Requested On',
                        render: (row) => new Date(row.createdAt).toLocaleDateString(),
                    },
                ]}
                rows={requests}
                loading={requestsLoading}
                page={requestsMeta.page}
                totalPages={requestsMeta.totalPages}
                total={requestsMeta.total}
                pageSize={requestsPageSize}
                onPageChange={(page) => loadRequests(page, requestsPageSize)}
                onPageSizeChange={(size) => {
                    setRequestsPageSize(size);
                    loadRequests(1, size);
                }}
                emptyText="No requests yet for this item"
            />

            <AdminFormModal open={rejectOpen} title="Reject Donation Item" onClose={() => setRejectOpen(false)} onSubmit={submitReject} busy={busy}>
                <FormSection title="Reason" className="md:col-span-2">
                    <FormField label="Admin Note" required className="md:col-span-2">
                        <textarea
                            className="form-textarea min-h-[100px]"
                            required
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Explain why this listing was not approved"
                        />
                    </FormField>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
