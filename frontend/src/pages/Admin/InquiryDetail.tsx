import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { FormField, FormSection, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';

const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function InquiryDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [inquiry, setInquiry] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [adminNote, setAdminNote] = useState('');

    const load = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const data = (await adminApi.getInquiry(id)) as any;
            setInquiry(data);
            setStatus(data.status);
            setAdminNote(data.adminNote ?? '');
            dispatch(setPageTitle(data.subject || 'Inquiry Detail'));
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!id) return;
        setBusy(true);
        try {
            await adminApi.updateInquiry(id, { status, adminNote });
            showAlert('Inquiry updated successfully');
            await load();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!id) return;
        const ok = await confirmAction('Delete this inquiry?');
        if (!ok) return;
        try {
            await adminApi.deleteInquiry(id);
            showAlert('Inquiry deleted successfully');
            navigate('/admin/inquiries');
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const infoCards = useMemo(() => {
        if (!inquiry) return [];
        return [
            { label: 'Name', value: inquiry.name },
            { label: 'Email', value: inquiry.email },
            { label: 'Mobile', value: inquiry.mobile },
            { label: 'Status', value: inquiry.status },
            { label: 'Received On', value: new Date(inquiry.createdAt).toLocaleString() },
            { label: 'Resolved On', value: inquiry.resolvedAt ? new Date(inquiry.resolvedAt).toLocaleString() : '—' },
        ];
    }, [inquiry]);

    if (loading) {
        return <div className="panel">Loading inquiry...</div>;
    }

    if (!inquiry) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'Inquiry not found'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/admin/inquiries')}>
                    Back to inquiries
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div className="flex items-start gap-3">
                    <Link to="/admin/inquiries" className="btn btn-outline-primary p-2 mt-0.5" aria-label="Back">
                        <IconArrowLeft className="w-4.5 h-4.5" />
                    </Link>
                    <div>
                        <h2 className="text-xl font-semibold dark:text-white-light">{inquiry.subject}</h2>
                        <p className="text-white-dark text-sm mt-1">{inquiry.message}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={inquiry.status} />
                    <button type="button" className="btn btn-outline-danger" onClick={remove}>
                        Delete
                    </button>
                </div>
            </div>

            <div className="panel mb-5">
                <h5 className="font-semibold text-lg mb-4">Inquiry information</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {infoCards.map((card) => (
                        <div key={card.label} className="rounded border border-[#ebedf2] dark:border-[#191e3a] p-4">
                            <div className="text-xs uppercase tracking-wide text-white-dark mb-1">{card.label}</div>
                            <div className="font-semibold break-all">{card.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            <form className="panel" onSubmit={submit}>
                <h5 className="font-semibold text-lg mb-4">Update Inquiry</h5>
                <FormSection title="Status & Notes">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Status" required>
                            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                                {STATUSES.map((option) => (
                                    <option key={option} value={option}>
                                        {option.replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Admin Note" className="sm:col-span-2">
                            <textarea
                                className="form-textarea min-h-[100px]"
                                value={adminNote}
                                onChange={(e) => setAdminNote(e.target.value)}
                                placeholder="Internal note, not visible to the app user"
                            />
                        </FormField>
                    </div>
                </FormSection>
                <div className="mt-5 flex justify-end">
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );
}
