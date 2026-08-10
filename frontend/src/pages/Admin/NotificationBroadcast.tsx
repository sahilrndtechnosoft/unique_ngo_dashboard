import { FormEvent, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { FormField } from '../../components/Admin/FormPrimitives';
import { showAlert } from '../../utils/alerts';

const BLOOD_GROUPS = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'];

export default function AdminNotificationBroadcast() {
    const dispatch = useDispatch();
    const [bloodGroups, setBloodGroups] = useState<string[]>([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        dispatch(setPageTitle('Send Notification'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleGroup = (group: string) => {
        setBloodGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]));
    };

    const selectAll = () => setBloodGroups(bloodGroups.length === BLOOD_GROUPS.length ? [] : [...BLOOD_GROUPS]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        try {
            const data = await adminApi.broadcastNotification({ bloodGroups, title, body });
            showAlert(`Matched ${data.matchedUsers} user(s) — ${data.delivered} of ${data.targeted} received a push`);
            setTitle('');
            setBody('');
            setBloodGroups([]);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <ul className="flex space-x-2 rtl:space-x-reverse">
                <li>
                    <span className="text-primary">Dashboard</span>
                </li>
                <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                    <span>Send Notification</span>
                </li>
            </ul>

            <div className="pt-5">
                <h2 className="text-xl font-semibold dark:text-white-light mb-5">Send Notification</h2>

                <form onSubmit={submit}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        <div className="panel">
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div>
                                    <h5 className="font-semibold text-lg dark:text-white-light">Target Audience</h5>
                                    <p className="text-white-dark text-sm mt-1">Users belonging to the selected blood group(s) will receive this notification</p>
                                </div>
                                <button type="button" className="btn btn-outline-primary btn-sm shrink-0" onClick={selectAll}>
                                    {bloodGroups.length === BLOOD_GROUPS.length ? 'Clear all' : 'Select all'}
                                </button>
                            </div>

                            <FormField label="Blood Groups" required hint={`${bloodGroups.length} of ${BLOOD_GROUPS.length} selected`}>
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
                                    {BLOOD_GROUPS.map((group) => {
                                        const checked = bloodGroups.includes(group);
                                        return (
                                            <label
                                                key={group}
                                                className={`flex items-center justify-center gap-2 cursor-pointer rounded border py-2.5 px-3 text-sm font-medium transition-colors ${
                                                    checked
                                                        ? 'border-primary bg-primary-light text-primary dark:bg-primary/20'
                                                        : 'border-[#ebedf2] dark:border-[#191e3a] hover:border-primary'
                                                }`}
                                            >
                                                <input type="checkbox" className="form-checkbox" checked={checked} onChange={() => toggleGroup(group)} />
                                                {group.replace('_', ' ')}
                                            </label>
                                        );
                                    })}
                                </div>
                            </FormField>
                        </div>

                        <div className="panel">
                            <div className="mb-5">
                                <h5 className="font-semibold text-lg dark:text-white-light">Compose Message</h5>
                                <p className="text-white-dark text-sm mt-1">This is what recipients will see as a push notification</p>
                            </div>

                            <div className="grid grid-cols-1 gap-5">
                                <FormField label="Title" required>
                                    <input className="form-input" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
                                </FormField>
                                <FormField label="Body" required>
                                    <textarea className="form-textarea min-h-[140px]" required value={body} onChange={(e) => setBody(e.target.value)} />
                                </FormField>
                            </div>

                            <div className="flex justify-end mt-6">
                                <button type="submit" className="btn btn-primary" disabled={busy || bloodGroups.length === 0}>
                                    {busy ? 'Sending...' : 'Send Notification'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
