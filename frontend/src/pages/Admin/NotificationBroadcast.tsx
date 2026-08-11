import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { useRowSelection } from '../../hooks/useRowSelection';
import { AdminDataTable, BulkActionsBar } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, RowActionsMenu } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';

const BLOOD_GROUPS = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'];
const TARGET_TYPES = [
    { value: 'BLOOD_GROUP', label: 'By Blood Group' },
    { value: 'SPECIFIC_USERS', label: 'Specific Users' },
    { value: 'ALL_USERS', label: 'All Users' },
];

export default function AdminNotificationBroadcast() {
    const dispatch = useDispatch();

    const [target, setTarget] = useState('BLOOD_GROUP');
    const [bloodGroups, setBloodGroups] = useState<string[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [userResults, setUserResults] = useState<any[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<{ id: string; label: string }[]>([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);

    const [items, setItems] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [pageSize, setPageSize] = useState(10);
    const [loading, setLoading] = useState(false);
    const [viewing, setViewing] = useState<any | null>(null);

    const ids = useMemo(() => items.map((item) => item.id), [items]);
    const selection = useRowSelection(ids);

    const loadHistory = async (page = 1, size = pageSize) => {
        setLoading(true);
        try {
            const data = await adminApi.listNotifications({ page, limit: size });
            setItems(data.items);
            setMeta(data.meta);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        dispatch(setPageTitle('Send Notification'));
        loadHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleGroup = (group: string) => {
        setBloodGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]));
    };

    const selectAllGroups = () => setBloodGroups(bloodGroups.length === BLOOD_GROUPS.length ? [] : [...BLOOD_GROUPS]);

    const searchUsers = async () => {
        if (!userSearch.trim()) {
            setUserResults([]);
            return;
        }
        try {
            const data = await adminApi.listUsers({ search: userSearch, limit: 10 });
            setUserResults(data.items);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const addUser = (user: any) => {
        if (selectedUsers.some((u) => u.id === user.id)) return;
        setSelectedUsers([...selectedUsers, { id: user.id, label: `${user.fullName} (${user.email ?? user.mobile ?? ''})` }]);
    };

    const removeUser = (id: string) => setSelectedUsers(selectedUsers.filter((u) => u.id !== id));

    const canSend =
        target === 'ALL_USERS' ||
        (target === 'BLOOD_GROUP' && bloodGroups.length > 0) ||
        (target === 'SPECIFIC_USERS' && selectedUsers.length > 0);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        try {
            const data = await adminApi.broadcastNotification({
                target,
                bloodGroups: target === 'BLOOD_GROUP' ? bloodGroups : undefined,
                userIds: target === 'SPECIFIC_USERS' ? selectedUsers.map((u) => u.id) : undefined,
                title,
                body,
            });
            showAlert(`Matched ${data.matchedUsers} user(s) — ${data.delivered} of ${data.targeted} received a push`);
            setTitle('');
            setBody('');
            setBloodGroups([]);
            setSelectedUsers([]);
            await loadHistory(1, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: string) => {
        const ok = await confirmAction('Delete this notification?');
        if (!ok) return;
        try {
            await adminApi.deleteNotification(id);
            showAlert('Notification deleted successfully');
            await loadHistory(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDelete = async () => {
        const ok = await confirmAction(`Delete ${selection.selectedIds.length} notification(s)?`);
        if (!ok) return;
        try {
            for (const id of selection.selectedIds) await adminApi.deleteNotification(id);
            selection.clear();
            showAlert('Selected notifications deleted');
            await loadHistory(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const view = async (row: any) => {
        try {
            const data = await adminApi.getNotification(row.id);
            setViewing(data);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
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
                                    <p className="text-white-dark text-sm mt-1">Choose who should receive this notification</p>
                                </div>
                                {target === 'BLOOD_GROUP' ? (
                                    <button type="button" className="btn btn-outline-primary btn-sm shrink-0" onClick={selectAllGroups}>
                                        {bloodGroups.length === BLOOD_GROUPS.length ? 'Clear all' : 'Select all'}
                                    </button>
                                ) : null}
                            </div>

                            <FormField label="Target Type" required className="mb-5">
                                <div className="flex flex-wrap gap-4">
                                    {TARGET_TYPES.map((t) => (
                                        <label key={t.value} className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" checked={target === t.value} onChange={() => setTarget(t.value)} />
                                            {t.label}
                                        </label>
                                    ))}
                                </div>
                            </FormField>

                            {target === 'BLOOD_GROUP' ? (
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
                            ) : null}

                            {target === 'SPECIFIC_USERS' ? (
                                <FormField label="Users" required hint="Search by name, email or mobile">
                                    {selectedUsers.length > 0 ? (
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            {selectedUsers.map((user) => (
                                                <span
                                                    key={user.id}
                                                    className="inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary dark:bg-primary/20"
                                                >
                                                    {user.label}
                                                    <button type="button" onClick={() => removeUser(user.id)} className="hover:text-danger">
                                                        &times;
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                    <div className="flex items-center gap-2">
                                        <input
                                            className="form-input"
                                            value={userSearch}
                                            onChange={(e) => setUserSearch(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    searchUsers();
                                                }
                                            }}
                                        />
                                        <button type="button" className="btn btn-primary btn-sm" onClick={searchUsers}>
                                            Search
                                        </button>
                                    </div>
                                    {userResults.length > 0 ? (
                                        <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-[#ebedf2] dark:border-[#191e3a]">
                                            {userResults.map((user) => (
                                                <li key={user.id}>
                                                    <button
                                                        type="button"
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-[#191e3a]"
                                                        onClick={() => addUser(user)}
                                                    >
                                                        {user.fullName} — {user.email ?? user.mobile ?? ''}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </FormField>
                            ) : null}

                            {target === 'ALL_USERS' ? (
                                <div className="rounded bg-warning-light p-3 text-sm text-warning">This will notify every active user in the system.</div>
                            ) : null}
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
                                <button type="submit" className="btn btn-primary" disabled={busy || !canSend}>
                                    {busy ? 'Sending...' : 'Send Notification'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>

                <h5 className="font-semibold text-lg dark:text-white-light mt-8 mb-4">Notification History</h5>

                <BulkActionsBar count={selection.selectedIds.length} onClear={selection.clear} onBulkDelete={bulkDelete} />

                <AdminDataTable
                    columns={[
                        {
                            key: 'title',
                            label: 'Title',
                            render: (row) => (
                                <div>
                                    <div className="font-semibold">{row.title}</div>
                                    <div className="text-xs text-white-dark line-clamp-1">{row.body}</div>
                                </div>
                            ),
                        },
                        {
                            key: 'recipient',
                            label: 'Recipient',
                            render: (row) => row.recipient?.fullName ?? row.recipient?.email ?? '—',
                        },
                        {
                            key: 'type',
                            label: 'Type',
                            render: (row) => row.type,
                        },
                        {
                            key: 'sentAt',
                            label: 'Sent',
                            render: (row) => (row.sentAt ? new Date(row.sentAt).toLocaleString() : 'Not delivered'),
                        },
                        {
                            key: 'createdAt',
                            label: 'Created At',
                            render: (row) => new Date(row.createdAt).toLocaleString(),
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
                    onPageChange={(page) => loadHistory(page, pageSize)}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        loadHistory(1, size);
                    }}
                    actions={(row) => (
                        <RowActionsMenu
                            actions={[
                                { label: 'View', onClick: () => view(row) },
                                { label: 'Delete', onClick: () => remove(row.id), danger: true },
                            ]}
                        />
                    )}
                    emptyText="No notifications sent yet"
                />
            </div>

            <AdminFormModal open={viewing !== null} title="Notification Detail" onClose={() => setViewing(null)} readOnly>
                {viewing ? (
                    <>
                        <FormField label="Title" className="md:col-span-2">
                            <p>{viewing.title}</p>
                        </FormField>
                        <FormField label="Body" className="md:col-span-2">
                            <p>{viewing.body}</p>
                        </FormField>
                        <FormField label="Recipient">
                            <p>{viewing.recipient?.fullName ?? '—'} {viewing.recipient?.email ? `(${viewing.recipient.email})` : ''}</p>
                        </FormField>
                        <FormField label="Type">
                            <p>{viewing.type}</p>
                        </FormField>
                        <FormField label="Sent At">
                            <p>{viewing.sentAt ? new Date(viewing.sentAt).toLocaleString() : 'Not delivered (no active device)'}</p>
                        </FormField>
                        <FormField label="Created At">
                            <p>{new Date(viewing.createdAt).toLocaleString()}</p>
                        </FormField>
                    </>
                ) : null}
            </AdminFormModal>
        </div>
    );
}
