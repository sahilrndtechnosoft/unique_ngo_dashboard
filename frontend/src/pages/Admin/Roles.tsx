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
type Tab = 'roles' | 'permissions';

const ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE'] as const;

interface PermissionItem {
    id: string;
    module: string;
    action: string;
    key: string;
    description?: string;
    label?: string;
}

interface PermissionModuleGroup {
    module: string;
    label: string;
    permissions: PermissionItem[];
}

const emptyForm = {
    name: '',
    slug: '',
    description: '',
    isActive: true,
};

export default function AdminRoles() {
    const dispatch = useDispatch();
    const [tab, setTab] = useState<Tab>('roles');
    const [roles, setRoles] = useState<any[]>([]);
    const [permissionGroups, setPermissionGroups] = useState<PermissionModuleGroup[]>([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<Mode | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);

    const filteredRoles = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return roles;
        return roles.filter(
            (role) =>
                role.name?.toLowerCase().includes(query) ||
                role.slug?.toLowerCase().includes(query) ||
                role.description?.toLowerCase().includes(query),
        );
    }, [roles, search]);

    const totalPages = Math.max(1, Math.ceil(filteredRoles.length / pageSize));
    const pagedRoles = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredRoles.slice(start, start + pageSize);
    }, [filteredRoles, page, pageSize]);

    const ids = useMemo(() => pagedRoles.map((role) => role.id), [pagedRoles]);
    const selection = useRowSelection(ids);

    const allPermissions = useMemo(
        () => permissionGroups.flatMap((group) => group.permissions),
        [permissionGroups],
    );

    const permissionByKey = useMemo(() => {
        const map = new Map<string, PermissionItem>();
        for (const permission of allPermissions) {
            map.set(`${permission.module}:${permission.action}`, permission);
        }
        return map;
    }, [allPermissions]);

    const loadRoles = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listRoles();
            setRoles(Array.isArray(data) ? data : []);
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadPermissions = async () => {
        try {
            const data = await adminApi.listPermissions();
            setPermissionGroups(Array.isArray(data) ? data : []);
        } catch (err) {
            showAlert(getErrorMessage(err, 'Failed to load permissions'), 'error');
        }
    };

    useEffect(() => {
        dispatch(setPageTitle('Roles & Permissions'));
        loadRoles();
        loadPermissions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setSelectedPermissionIds([]);
        setMode('create');
    };

    const fillRole = (role: any) => {
        setEditingId(role.id);
        setForm({
            name: role.name ?? '',
            slug: role.slug ?? '',
            description: role.description ?? '',
            isActive: role.isActive !== false,
        });
        setSelectedPermissionIds((role.permissions ?? []).map((permission: PermissionItem) => permission.id));
    };

    const openEdit = (role: any) => {
        fillRole(role);
        setMode('edit');
    };

    const openView = (role: any) => {
        fillRole(role);
        setMode('view');
    };

    const isPermissionChecked = (module: string, action: string) => {
        const permission = permissionByKey.get(`${module}:${action}`);
        return permission ? selectedPermissionIds.includes(permission.id) : false;
    };

    const togglePermission = (module: string, action: string) => {
        if (mode === 'view') return;
        const permission = permissionByKey.get(`${module}:${action}`);
        if (!permission) return;
        setSelectedPermissionIds((prev) =>
            prev.includes(permission.id) ? prev.filter((id) => id !== permission.id) : [...prev, permission.id],
        );
    };

    const toggleModuleAll = (group: PermissionModuleGroup, checked: boolean) => {
        if (mode === 'view') return;
        const moduleIds = group.permissions.map((permission) => permission.id);
        setSelectedPermissionIds((prev) => {
            if (checked) {
                return Array.from(new Set([...prev, ...moduleIds]));
            }
            return prev.filter((id) => !moduleIds.includes(id));
        });
    };

    const toggleAllPermissions = (checked: boolean) => {
        if (mode === 'view') return;
        setSelectedPermissionIds(checked ? allPermissions.map((permission) => permission.id) : []);
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const body = {
                name: form.name.trim(),
                slug: form.slug.trim() || undefined,
                description: form.description.trim() || undefined,
                permissionIds: selectedPermissionIds,
            };

            if (mode === 'create') {
                await adminApi.createRole(body);
                showAlert('Role created successfully');
            } else if (editingId) {
                await adminApi.updateRole(editingId, {
                    ...body,
                    isActive: form.isActive,
                });
                showAlert('Role updated successfully');
            }
            setMode(null);
            selection.clear();
            await loadRoles();
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (role: any) => {
        if (role.isSystem) {
            showAlert('System roles cannot be deleted', 'warning');
            return;
        }
        const ok = await confirmAction('Delete role?', 'Users assigned to this role must be reassigned first.');
        if (!ok) return;
        try {
            await adminApi.deleteRole(role.id);
            showAlert('Role deleted successfully');
            await loadRoles();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDelete = async () => {
        const selected = roles.filter((role) => selection.selectedIds.includes(role.id));
        const deletable = selected.filter((role) => !role.isSystem);
        if (!deletable.length) {
            showAlert('No deletable roles selected (system roles are protected)', 'warning');
            return;
        }
        const ok = await confirmAction(`Delete ${deletable.length} role(s)?`);
        if (!ok) return;
        try {
            for (const role of deletable) {
                await adminApi.deleteRole(role.id);
            }
            selection.clear();
            showAlert('Selected roles deleted');
            await loadRoles();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const readOnly = mode === 'view';
    const allSelectedCount = selectedPermissionIds.length;
    const totalPermissionCount = allPermissions.length;

    return (
        <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold dark:text-white-light">Roles & Permissions</h2>
                    <p className="text-white-dark text-sm mt-1">Create roles and assign View / Create / Edit / Delete permissions</p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className={`btn ${tab === 'roles' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setTab('roles')}
                    >
                        Roles
                    </button>
                    <button
                        type="button"
                        className={`btn ${tab === 'permissions' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setTab('permissions')}
                    >
                        Permissions catalog
                    </button>
                </div>
            </div>

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

            {tab === 'roles' ? (
                <>
                    <AdminPageHeader
                        title="Roles"
                        subtitle="Manage RBAC roles and their permission matrix"
                        search={search}
                        onSearchChange={(value) => {
                            setSearch(value);
                            setPage(1);
                        }}
                        onSearch={() => setPage(1)}
                        onClear={() => {
                            setSearch('');
                            setPage(1);
                        }}
                        canClear={Boolean(search)}
                        onCreate={openCreate}
                        createLabel="Add Role"
                    />

                    <BulkActionsBar count={selection.selectedIds.length} onClear={selection.clear} onBulkDelete={bulkDelete} />

                    <AdminDataTable
                        columns={[
                            {
                                key: 'name',
                                label: 'Name',
                                sortable: true,
                                sortValue: (row) => row.name,
                                render: (row) => (
                                    <div>
                                        <div className="font-semibold">{row.name}</div>
                                        {row.isSystem ? <span className="badge badge-outline-warning mt-1">System</span> : null}
                                    </div>
                                ),
                            },
                            {
                                key: 'slug',
                                label: 'Slug',
                                sortable: true,
                                sortValue: (row) => row.slug,
                                render: (row) => row.slug,
                            },
                            {
                                key: 'description',
                                label: 'Description',
                                sortable: true,
                                sortValue: (row) => row.description,
                                render: (row) => row.description || '—',
                            },
                            {
                                key: 'permissions',
                                label: 'Permissions',
                                sortable: true,
                                sortValue: (row) => row.permissions?.length ?? 0,
                                render: (row) => row.permissions?.length ?? 0,
                            },
                            {
                                key: 'userCount',
                                label: 'Users',
                                sortable: true,
                                sortValue: (row) => row.userCount ?? 0,
                                render: (row) => row.userCount ?? 0,
                            },
                            {
                                key: 'isActive',
                                label: 'Status',
                                sortable: true,
                                sortValue: (row) => (row.isActive ? 'ACTIVE' : 'INACTIVE'),
                                render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
                            },
                        ]}
                        rows={pagedRoles}
                        loading={loading}
                        selectedIds={selection.selectedIds}
                        allSelected={selection.allSelected}
                        someSelected={selection.someSelected}
                        onToggleAll={selection.toggleAll}
                        onToggle={selection.toggle}
                        page={page}
                        totalPages={totalPages}
                        total={filteredRoles.length}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(size) => {
                            setPageSize(size);
                            setPage(1);
                        }}
                        actions={(row) => (
                            <RowActionsMenu
                                actions={[
                                    { label: 'View', onClick: () => openView(row) },
                                    { label: 'Edit', onClick: () => openEdit(row) },
                                    {
                                        label: 'Delete',
                                        onClick: () => remove(row),
                                        danger: true,
                                        hidden: row.isSystem,
                                    },
                                ]}
                            />
                        )}
                        emptyText="No roles found"
                    />
                </>
            ) : (
                <div className="panel">
                    <div className="mb-4">
                        <h5 className="font-semibold text-lg">Permissions catalog</h5>
                        <p className="text-white-dark text-sm mt-1">
                            System-defined permissions ({totalPermissionCount}). Assign these to roles from the Roles tab.
                        </p>
                    </div>
                    <div className="space-y-4">
                        {permissionGroups.map((group) => (
                            <div key={group.module} className="border border-[#ebedf2] dark:border-[#191e3a] rounded-md overflow-hidden">
                                <div className="bg-[#fbfbfb] dark:bg-[#121c2c] px-4 py-2 font-semibold">{group.label}</div>
                                <div className="table-responsive">
                                    <table className="table-hover">
                                        <thead>
                                            <tr>
                                                <th>Key</th>
                                                <th>Action</th>
                                                <th>Description</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.permissions.map((permission) => (
                                                <tr key={permission.id}>
                                                    <td className="font-mono text-xs">{permission.key}</td>
                                                    <td>{permission.action}</td>
                                                    <td>{permission.description || permission.label || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                        {!permissionGroups.length ? <p className="text-white-dark">No permissions found. Run the database seed.</p> : null}
                    </div>
                </div>
            )}

            <AdminFormModal
                open={mode !== null}
                title={mode === 'create' ? 'Create Role' : mode === 'edit' ? 'Edit Role' : 'View Role'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                readOnly={readOnly}
                busy={busy}
                size="xl"
                extra={
                    <div className="mt-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <div>
                                <h6 className="font-semibold">Permissions</h6>
                                <p className="text-xs text-white-dark mt-1">
                                    {allSelectedCount} of {totalPermissionCount} selected
                                </p>
                            </div>
                            {!readOnly ? (
                                <div className="flex gap-2">
                                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => toggleAllPermissions(true)}>
                                        Select all
                                    </button>
                                    <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => toggleAllPermissions(false)}>
                                        Clear all
                                    </button>
                                </div>
                            ) : null}
                        </div>
                        <div className="max-h-[420px] overflow-auto border border-[#ebedf2] dark:border-[#191e3a] rounded-md">
                            <table className="table-hover text-sm">
                                <thead className="sticky top-0 z-[1] bg-[#fbfbfb] dark:bg-[#121c2c] shadow-sm">
                                    <tr>
                                        <th className="!py-2.5">Module</th>
                                        {ACTIONS.map((action) => (
                                            <th key={action} className="text-center !py-2.5">
                                                {action}
                                            </th>
                                        ))}
                                        <th className="text-center !py-2.5 bg-primary/5">All</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissionGroups.map((group, index) => {
                                        const moduleIds = group.permissions.map((permission) => permission.id);
                                        const allModuleSelected =
                                            moduleIds.length > 0 && moduleIds.every((id) => selectedPermissionIds.includes(id));
                                        return (
                                            <tr
                                                key={group.module}
                                                className={index % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-[#fafbfc] dark:bg-[#0e1726]/50'}
                                            >
                                                <td className="font-semibold whitespace-nowrap !py-2">{group.label}</td>
                                                {ACTIONS.map((action) => {
                                                    const available = permissionByKey.has(`${group.module}:${action}`);
                                                    return (
                                                        <td key={action} className="text-center !py-2">
                                                            {available ? (
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-checkbox"
                                                                    disabled={readOnly}
                                                                    checked={isPermissionChecked(group.module, action)}
                                                                    onChange={() => togglePermission(group.module, action)}
                                                                    aria-label={`${group.module}:${action}`}
                                                                />
                                                            ) : (
                                                                <span className="text-white-dark">—</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="text-center !py-2 bg-primary/5">
                                                    <input
                                                        type="checkbox"
                                                        className="form-checkbox"
                                                        disabled={readOnly}
                                                        checked={allModuleSelected}
                                                        onChange={(e) => toggleModuleAll(group, e.target.checked)}
                                                        aria-label={`All ${group.module}`}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                }
            >
                <FormSection title="Role details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Role name" required>
                            <input
                                className="form-input"
                                required
                                disabled={readOnly}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Slug" hint="Leave blank to auto-generate from name">
                            <input
                                className="form-input"
                                disabled={readOnly}
                                value={form.slug}
                                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Description" className="md:col-span-2">
                            <textarea
                                className="form-textarea min-h-[90px]"
                                disabled={readOnly}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </FormField>
                        {mode !== 'create' ? (
                            <FormField label="Status">
                                <label className="flex items-center gap-2 h-[38px]">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox"
                                        disabled={readOnly}
                                        checked={form.isActive}
                                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                    />
                                    Active
                                </label>
                            </FormField>
                        ) : null}
                    </div>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
