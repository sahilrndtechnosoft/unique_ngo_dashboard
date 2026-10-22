import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import {
    DetailFacts,
    FormField,
    FormSection,
    StatusBadge,
} from '../../components/Admin/FormPrimitives';
import AdminFormModal from '../../components/Admin/AdminFormModal';
import { showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';
import IconEdit from '../../components/Icon/IconEdit';
import IconTrashLines from '../../components/Icon/IconTrashLines';
import IconLink from '../../components/Icon/IconLink';

const PARTNER_CATEGORIES = [
    { value: 'FOOD_BEVERAGE', label: 'Food & Beverage' },
    { value: 'RETAIL', label: 'Retail & Shopping' },
    { value: 'HEALTHCARE', label: 'Healthcare & Pharmacy' },
    { value: 'ENTERTAINMENT', label: 'Entertainment' },
    { value: 'TRAVEL', label: 'Travel & Mobility' },
    { value: 'EDUCATION', label: 'Education' },
    { value: 'OTHER', label: 'Other' },
];

const ADAPTER_TYPES = [
    { value: 'MOCK', label: 'Mock / Direct Engine' },
    { value: 'PIZZA_HUT', label: 'Pizza Hut API' },
    { value: 'GENERIC_REST', label: 'Generic Webhook / REST' },
];

export default function PartnerDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [partner, setPartner] = useState<any | null>(null);
    const [catalogItems, setCatalogItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [busy, setBusy] = useState(false);

    const [form, setForm] = useState({
        name: '',
        slug: '',
        category: 'FOOD_BEVERAGE',
        adapterType: 'MOCK',
        description: '',
        logoUrl: '',
        websiteUrl: '',
        apiEndpoint: '',
        isActive: true,
    });

    const load = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const [partnerData, catalogData] = await Promise.all([
                adminApi.getPartner(id),
                adminApi.listCatalogItems({ partnerStoreId: id, limit: 50 }).catch(() => ({ items: [] })),
            ]);
            setPartner(partnerData);
            setCatalogItems(catalogData.items || []);
            dispatch(setPageTitle(`${(partnerData as any)?.name || 'Partner Store'} - Details`));
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

    const openEditModal = () => {
        if (!partner) return;
        setForm({
            name: partner.name || '',
            slug: partner.slug || '',
            category: partner.category || 'FOOD_BEVERAGE',
            adapterType: partner.adapterType || 'MOCK',
            description: partner.description || '',
            logoUrl: partner.logoUrl || '',
            websiteUrl: partner.websiteUrl || '',
            apiEndpoint: partner.apiEndpoint || '',
            isActive: Boolean(partner.isActive),
        });
        setIsEditing(true);
    };

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        if (!id) return;
        setBusy(true);
        try {
            await adminApi.updatePartner(id, {
                name: form.name.trim(),
                slug: form.slug.trim(),
                category: form.category,
                adapterType: form.adapterType,
                description: form.description.trim() || undefined,
                logoUrl: form.logoUrl.trim() || undefined,
                websiteUrl: form.websiteUrl.trim() || undefined,
                apiEndpoint: form.apiEndpoint.trim() || undefined,
                isActive: form.isActive,
            });
            showAlert('Partner store updated successfully');
            setIsEditing(false);
            await load();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const handleToggleActive = async () => {
        if (!partner || !id) return;
        try {
            await adminApi.updatePartner(id, { isActive: !partner.isActive });
            showAlert(partner.isActive ? 'Partner store deactivated' : 'Partner store activated');
            await load();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        const ok = window.confirm(`Are you sure you want to delete partner store "${partner?.name}"?`);
        if (!ok) return;
        try {
            await adminApi.deletePartner(id);
            showAlert('Partner store deleted successfully');
            navigate('/admin/partners');
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const facts = useMemo(() => {
        if (!partner) return [];
        return [
            { label: 'Store Name', value: partner.name },
            { label: 'Slug', value: partner.slug },
            { label: 'Category', value: partner.category?.replace(/_/g, ' ') },
            { label: 'Adapter Engine', value: partner.adapterType },
            {
                label: 'Website',
                value: partner.websiteUrl ? (
                    <a
                        href={partner.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                    >
                        {partner.websiteUrl} <IconLink className="w-3.5 h-3.5" />
                    </a>
                ) : (
                    '—'
                ),
            },
            { label: 'API Endpoint', value: partner.apiEndpoint || 'Internal Mock Adapter' },
            { label: 'Status', value: <StatusBadge status={partner.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
            { label: 'Onboarded Date', value: partner.createdAt ? new Date(partner.createdAt).toLocaleString() : '—' },
            { label: 'Last Updated', value: partner.updatedAt ? new Date(partner.updatedAt).toLocaleString() : '—' },
        ];
    }, [partner]);

    if (loading) {
        return <div className="panel">Loading partner store details...</div>;
    }

    if (!partner) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'Partner store not found'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/admin/partners')}>
                    Back to Partner Stores
                </button>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <Link to="/admin/partners" className="btn btn-outline-primary p-2" aria-label="Back">
                        <IconArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-3">
                        {partner.logoUrl ? (
                            <img
                                src={partner.logoUrl}
                                alt={partner.name}
                                className="h-12 w-12 rounded-lg object-cover shadow-sm border border-gray-200 dark:border-gray-700"
                            />
                        ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-light font-bold text-primary text-xl shadow-sm">
                                {partner.name.charAt(0)}
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-bold dark:text-white-light">{partner.name}</h2>
                                <StatusBadge status={partner.isActive ? 'ACTIVE' : 'INACTIVE'} />
                            </div>
                            <p className="text-white-dark text-sm mt-0.5">
                                {partner.description || 'Merchant partner store for points redemption and vouchers'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button type="button" className="btn btn-outline-primary gap-1.5" onClick={openEditModal}>
                        <IconEdit className="w-4 h-4" /> Edit
                    </button>
                    <button
                        type="button"
                        className={partner.isActive ? 'btn btn-outline-warning' : 'btn btn-outline-success'}
                        onClick={handleToggleActive}
                    >
                        {partner.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className="btn btn-outline-danger gap-1.5" onClick={handleDelete}>
                        <IconTrashLines className="w-4 h-4" /> Delete
                    </button>
                </div>
            </div>

            {/* Facts Panel */}
            <div className="panel mb-6">
                <h5 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white-light">Store Information</h5>
                <DetailFacts items={facts} />
            </div>

            {/* Adapter Config Panel */}
            {partner.config && Object.keys(partner.config).length > 0 ? (
                <div className="panel mb-6">
                    <h5 className="font-semibold text-lg mb-3 text-gray-900 dark:text-white-light">Adapter Configuration</h5>
                    <div className="rounded bg-gray-50 dark:bg-gray-900 p-4 font-mono text-xs overflow-x-auto text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-800">
                        <pre>{JSON.stringify(partner.config, null, 2)}</pre>
                    </div>
                </div>
            ) : null}

            {/* Associated Catalog Items Sub-Table */}
            <div className="panel">
                <div className="flex items-center justify-between mb-4">
                    <h5 className="font-semibold text-lg text-gray-900 dark:text-white-light">
                        Offered Vouchers & Rewards ({catalogItems.length})
                    </h5>
                    <Link to="/admin/rewards-catalog" className="btn btn-sm btn-outline-primary">
                        Catalog Manager
                    </Link>
                </div>

                {catalogItems.length === 0 ? (
                    <div className="text-center py-8 text-white-dark">
                        No rewards or voucher catalog items currently assigned to this partner store.
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table-hover">
                            <thead>
                                <tr>
                                    <th>Reward Title</th>
                                    <th>Category</th>
                                    <th>Points Cost</th>
                                    <th>Monetary Value</th>
                                    <th>Stock</th>
                                    <th>Status</th>
                                    <th className="text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {catalogItems.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                {item.imageUrl ? (
                                                    <img
                                                        src={item.imageUrl}
                                                        alt={item.title}
                                                        className="w-8 h-8 rounded object-cover"
                                                    />
                                                ) : null}
                                                <div className="font-semibold">{item.title}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge badge-outline-secondary">{item.category}</span>
                                        </td>
                                        <td>
                                            <span className="font-bold text-primary">{item.pointsCost} pts</span>
                                        </td>
                                        <td>₹{item.monetaryValue}</td>
                                        <td>{item.stock !== null && item.stock !== undefined ? `${item.stock}` : 'Unlimited'}</td>
                                        <td>
                                            <StatusBadge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
                                        </td>
                                        <td className="text-center">
                                            <Link
                                                to={`/admin/rewards-catalog/${item.id}`}
                                                className="btn btn-sm btn-outline-primary"
                                            >
                                                View Item
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <AdminFormModal
                open={isEditing}
                title="Edit Partner Store"
                onClose={() => setIsEditing(false)}
                onSubmit={handleSave}
                busy={busy}
                size="lg"
            >
                <FormSection title="Store Details">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Store Name" required>
                            <input
                                className="form-input"
                                required
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Slug" required>
                            <input
                                className="form-input font-mono"
                                required
                                value={form.slug}
                                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Category" required>
                            <select
                                className="form-select"
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                            >
                                {PARTNER_CATEGORIES.map((c) => (
                                    <option key={c.value} value={c.value}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Adapter Type" required>
                            <select
                                className="form-select"
                                value={form.adapterType}
                                onChange={(e) => setForm({ ...form, adapterType: e.target.value })}
                            >
                                {ADAPTER_TYPES.map((a) => (
                                    <option key={a.value} value={a.value}>
                                        {a.label}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Website URL" className="md:col-span-2">
                            <input
                                className="form-input"
                                type="url"
                                value={form.websiteUrl}
                                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Logo URL" className="md:col-span-2">
                            <input
                                className="form-input"
                                type="url"
                                value={form.logoUrl}
                                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                            />
                        </FormField>
                        <FormField label="API Endpoint URL" className="md:col-span-2">
                            <input
                                className="form-input font-mono"
                                value={form.apiEndpoint}
                                onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Description" className="md:col-span-2">
                            <textarea
                                className="form-textarea"
                                rows={3}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </FormField>
                    </div>
                </FormSection>
            </AdminFormModal>
        </div>
    );
}
