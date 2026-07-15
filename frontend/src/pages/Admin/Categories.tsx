import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage, mediaUrl } from '../../services/api';
import { useRowSelection } from '../../hooks/useRowSelection';
import { AdminDataTable, AdminPageHeader, BulkActionsBar } from '../../components/Admin/AdminTable';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { FormField, FormSection, RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { confirmAction, showAlert } from '../../utils/alerts';

type Mode = 'create' | 'edit' | 'view';

const emptyForm = {
    name: '',
    slug: '',
    description: '',
    sortOrder: 0,
    isActive: true,
    isFeatured: false,
    imageUrl: '' as string | null,
};

export default function AdminCategories() {
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
    const [pendingImage, setPendingImage] = useState<File | null>(null);

    const ids = useMemo(() => items.map((item) => item.id), [items]);
    const selection = useRowSelection(ids);

    const load = async (page = 1, size = pageSize, filters?: { search?: string }) => {
        const nextSearch = filters?.search ?? search;
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.listCategories({ page, limit: size, search: nextSearch || undefined });
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
        dispatch(setPageTitle('Categories'));
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setPendingImage(null);
        setMode('create');
    };

    const fillForm = (category: any) => {
        setEditingId(category.id);
        setForm({
            name: category.name,
            slug: category.slug,
            description: category.description ?? '',
            sortOrder: category.sortOrder ?? 0,
            isActive: category.isActive,
            isFeatured: category.isFeatured,
            imageUrl: category.imageUrl,
        });
        setPendingImage(null);
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const body = {
                name: form.name,
                slug: form.slug || undefined,
                description: form.description || undefined,
                sortOrder: Number(form.sortOrder),
                isActive: form.isActive,
                isFeatured: form.isFeatured,
            };
            let id = editingId;
            if (mode === 'create') {
                const created = (await adminApi.createCategory(body)) as any;
                id = created?.id;
                showAlert('Category created successfully');
            } else if (editingId) {
                await adminApi.updateCategory(editingId, body);
                showAlert('Category updated successfully');
            }
            if (id && pendingImage) {
                await adminApi.uploadCategoryImage(id, pendingImage);
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
        const ok = await confirmAction('Delete category?');
        if (!ok) return;
        try {
            await adminApi.deleteCategory(id);
            showAlert('Category deleted successfully');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const bulkDelete = async () => {
        const ok = await confirmAction(`Delete ${selection.selectedIds.length} categories?`);
        if (!ok) return;
        try {
            for (const id of selection.selectedIds) await adminApi.deleteCategory(id);
            selection.clear();
            showAlert('Selected categories deleted');
            await load(meta.page, pageSize);
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const readOnly = mode === 'view';

    return (
        <div>
            <AdminPageHeader
                title="Categories"
                subtitle="Organize the product catalog"
                search={search}
                onSearchChange={setSearch}
                onSearch={() => load(1, pageSize)}
                onClear={clearFilters}
                canClear={Boolean(search)}
                onCreate={openCreate}
                createLabel="Add Category"
            />

            {error ? <div className="mb-4 rounded bg-danger-light p-3 text-danger">{error}</div> : null}

            <BulkActionsBar count={selection.selectedIds.length} onClear={selection.clear} onBulkDelete={bulkDelete} />

            <AdminDataTable
                columns={[
                    {
                        key: 'image',
                        label: 'Image',
                        render: (row) =>
                            row.imageUrl ? (
                                <img src={mediaUrl(row.imageUrl)} alt={row.name} className="h-10 w-10 rounded object-cover" />
                            ) : (
                                <span className="text-xs text-white-dark">—</span>
                            ),
                    },
                    {
                        key: 'name',
                        label: 'Name',
                        sortable: true,
                        sortValue: (row) => row.name,
                        render: (row) => <span className="font-semibold">{row.name}</span>,
                    },
                    {
                        key: 'slug',
                        label: 'Slug',
                        sortable: true,
                        sortValue: (row) => row.slug,
                        render: (row) => row.slug,
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        sortable: true,
                        sortValue: (row) => (row.isActive ? 'ACTIVE' : 'INACTIVE'),
                        render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
                    },
                    {
                        key: 'featured',
                        label: 'Featured',
                        sortable: true,
                        sortValue: (row) => (row.isFeatured ? 1 : 0),
                        render: (row) => (row.isFeatured ? 'Yes' : 'No'),
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
                title={mode === 'create' ? 'Create Category' : mode === 'edit' ? 'Edit Category' : 'View Category'}
                onClose={() => setMode(null)}
                onSubmit={submit}
                readOnly={readOnly}
                busy={busy}
            >
                <FormSection title="Category details" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField label="Name" required>
                            <input className="form-input" required disabled={readOnly} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </FormField>
                        <FormField label="Slug" hint="Leave blank to auto-generate">
                            <input className="form-input" disabled={readOnly} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                        </FormField>
                        <FormField label="Sort Order">
                            <input
                                className="form-input"
                                type="number"
                                disabled={readOnly}
                                value={form.sortOrder}
                                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                            />
                        </FormField>
                        <FormField label="Flags">
                            <div className="flex items-center gap-5 h-[38px]">
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
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox"
                                        disabled={readOnly}
                                        checked={form.isFeatured}
                                        onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                                    />
                                    Featured
                                </label>
                            </div>
                        </FormField>
                        <FormField label="Description" className="md:col-span-2">
                            <textarea className="form-textarea min-h-[100px]" disabled={readOnly} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </FormField>
                        <FormField label="Image" className="md:col-span-2">
                            <div className="flex items-center gap-4">
                                {form.imageUrl ? <img src={mediaUrl(form.imageUrl)} alt="" className="h-16 w-16 rounded object-cover" /> : null}
                                {!readOnly ? (
                                    <input type="file" accept="image/*" className="form-input" onChange={(e) => setPendingImage(e.target.files?.[0] ?? null)} />
                                ) : null}
                            </div>
                        </FormField>
                    </div>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
