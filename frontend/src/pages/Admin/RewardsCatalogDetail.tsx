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

const ITEM_TYPES = [
    { value: 'VOUCHER', label: 'Partner / Store Voucher' },
    { value: 'POINTS_PURCHASE', label: 'Points Discount / Purchase' },
    { value: 'PHYSICAL_PRODUCT', label: 'Physical Gift Item' },
];

const TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

export default function RewardsCatalogDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [item, setItem] = useState<any | null>(null);
    const [partners, setPartners] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [busy, setBusy] = useState(false);

    const [form, setForm] = useState({
        title: '',
        description: '',
        category: 'FOOD_BEVERAGE',
        itemType: 'VOUCHER',
        pointsCost: '100',
        monetaryValue: '50',
        partnerStoreId: '',
        stock: '',
        isUnlimitedStock: true,
        validityDays: '30',
        minUserTier: 'BRONZE',
        perUserLimit: '5',
        imageUrl: '',
        voucherConfig: {
            prefix: '',
            terms: '',
            instructions: '',
        },
        isActive: true,
    });

    const load = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const [itemData, partnersData] = await Promise.all([
                adminApi.getCatalogItem(id),
                adminApi.listPartners({ limit: 100 }).catch(() => ({ items: [] })),
            ]);
            setItem(itemData);
            setPartners(partnersData.items || []);
            dispatch(setPageTitle(`${(itemData as any)?.title || 'Reward Item'} - Details`));
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
        if (!item) return;
        setForm({
            title: item.title || '',
            description: item.description || '',
            category: item.category || 'FOOD_BEVERAGE',
            itemType: item.itemType || 'VOUCHER',
            pointsCost: String(item.pointsCost ?? 0),
            monetaryValue: String(item.monetaryValue ?? 0),
            partnerStoreId: item.partnerStoreId || '',
            stock: item.stock !== null && item.stock !== undefined ? String(item.stock) : '',
            isUnlimitedStock: item.stock === null || item.stock === undefined,
            validityDays: String(item.validityDays ?? 30),
            minUserTier: item.minUserTier || 'BRONZE',
            perUserLimit: String(item.perUserLimit ?? 1),
            imageUrl: item.imageUrl || '',
            voucherConfig: {
                prefix: item.voucherConfig?.prefix || '',
                terms: item.voucherConfig?.terms || '',
                instructions: item.voucherConfig?.instructions || '',
            },
            isActive: Boolean(item.isActive),
        });
        setIsEditing(true);
    };

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        if (!id) return;
        setBusy(true);
        try {
            await adminApi.updateCatalogItem(id, {
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                category: form.category,
                itemType: form.itemType,
                pointsCost: Number(form.pointsCost),
                monetaryValue: Number(form.monetaryValue),
                partnerStoreId: form.partnerStoreId || null,
                stock: form.isUnlimitedStock ? null : Number(form.stock),
                validityDays: Number(form.validityDays),
                minUserTier: form.minUserTier,
                perUserLimit: Number(form.perUserLimit),
                imageUrl: form.imageUrl.trim() || undefined,
                voucherConfig: form.voucherConfig,
                isActive: form.isActive,
            });
            showAlert('Reward catalog item updated successfully');
            setIsEditing(false);
            await load();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const handleToggleActive = async () => {
        if (!item || !id) return;
        try {
            await adminApi.updateCatalogItem(id, { isActive: !item.isActive });
            showAlert(item.isActive ? 'Catalog item deactivated' : 'Catalog item activated');
            await load();
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        const ok = window.confirm(`Are you sure you want to delete reward "${item?.title}"?`);
        if (!ok) return;
        try {
            await adminApi.deleteCatalogItem(id);
            showAlert('Reward item deleted successfully');
            navigate('/admin/rewards-catalog');
        } catch (err) {
            showAlert(getErrorMessage(err), 'error');
        }
    };

    const facts = useMemo(() => {
        if (!item) return [];
        return [
            { label: 'Item Title', value: item.title },
            { label: 'Type', value: item.itemType?.replace(/_/g, ' ') },
            { label: 'Category', value: item.category?.replace(/_/g, ' ') },
            { label: 'Points Cost', value: `${item.pointsCost} points` },
            { label: 'Monetary Value', value: `₹${item.monetaryValue}` },
            {
                label: 'Stock Availability',
                value: item.stock !== null && item.stock !== undefined ? `${item.stock} remaining` : 'Unlimited',
            },
            { label: 'Min User Tier', value: <span className="badge badge-outline-secondary">{item.minUserTier}</span> },
            { label: 'Per-User Limit', value: `${item.perUserLimit} times per user` },
            { label: 'Voucher Validity', value: `${item.validityDays} days from issuance` },
            { label: 'Status', value: <StatusBadge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
            { label: 'Created At', value: item.createdAt ? new Date(item.createdAt).toLocaleString() : '—' },
            { label: 'Last Updated', value: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—' },
        ];
    }, [item]);

    if (loading) {
        return <div className="panel">Loading reward item details...</div>;
    }

    if (!item) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'Reward item not found'}</p>
                <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => navigate('/admin/rewards-catalog')}
                >
                    Back to Rewards Catalog
                </button>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <Link to="/admin/rewards-catalog" className="btn btn-outline-primary p-2" aria-label="Back">
                        <IconArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                            <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="h-14 w-14 rounded-lg object-cover shadow-sm border border-gray-200 dark:border-gray-700"
                            />
                        ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary-light font-bold text-primary text-2xl shadow-sm">
                                🎁
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-bold dark:text-white-light">{item.title}</h2>
                                <StatusBadge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
                                <span className="badge badge-outline-primary text-xs">{item.itemType}</span>
                            </div>
                            <p className="text-white-dark text-sm mt-0.5">
                                {item.description || 'Redeemable reward item / voucher in the member points catalog'}
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
                        className={item.isActive ? 'btn btn-outline-warning' : 'btn btn-outline-success'}
                        onClick={handleToggleActive}
                    >
                        {item.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className="btn btn-outline-danger gap-1.5" onClick={handleDelete}>
                        <IconTrashLines className="w-4 h-4" /> Delete
                    </button>
                </div>
            </div>

            {/* Facts Panel */}
            <div className="panel mb-6">
                <h5 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white-light">Reward Information</h5>
                <DetailFacts items={facts} />
            </div>

            {/* Linked Partner Store Card */}
            {item.partnerStore ? (
                <div className="panel mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h5 className="font-semibold text-lg text-gray-900 dark:text-white-light">Partner Merchant</h5>
                        <Link
                            to={`/admin/partners/${item.partnerStore.id}`}
                            className="text-primary hover:underline flex items-center gap-1 text-sm font-semibold"
                        >
                            View Store Details <IconLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                        {item.partnerStore.logoUrl ? (
                            <img
                                src={item.partnerStore.logoUrl}
                                alt={item.partnerStore.name}
                                className="h-12 w-12 rounded object-cover shadow-sm"
                            />
                        ) : (
                            <div className="h-12 w-12 rounded bg-primary-light text-primary font-bold flex items-center justify-center text-xl">
                                {item.partnerStore.name?.charAt(0)}
                            </div>
                        )}
                        <div>
                            <div className="font-bold text-lg text-gray-900 dark:text-white-light">
                                {item.partnerStore.name}
                            </div>
                            <div className="text-xs text-white-dark mt-0.5">
                                Category: {item.partnerStore.category?.replace(/_/g, ' ')} • Slug:{' '}
                                <code className="font-mono text-xs">{item.partnerStore.slug}</code>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Voucher Terms & Instructions Template */}
            {item.voucherConfig ? (
                <div className="panel">
                    <h5 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white-light">
                        Voucher Template & Fulfillment Instructions
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <div className="text-xs font-semibold text-white-dark uppercase tracking-wider mb-1">
                                Code Prefix
                            </div>
                            <div className="font-mono text-sm font-bold text-primary">
                                {item.voucherConfig.prefix || 'Standard (None)'}
                            </div>
                        </div>
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <div className="text-xs font-semibold text-white-dark uppercase tracking-wider mb-1">
                                Redemption Instructions
                            </div>
                            <div className="text-sm text-gray-800 dark:text-gray-200">
                                {item.voucherConfig.instructions || 'Present barcode or code at partner cashier POS.'}
                            </div>
                        </div>
                        <div className="md:col-span-2 p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <div className="text-xs font-semibold text-white-dark uppercase tracking-wider mb-1">
                                Terms & Conditions
                            </div>
                            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                {item.voucherConfig.terms || 'Standard platform voucher terms apply.'}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Edit Modal */}
            <AdminFormModal
                open={isEditing}
                title="Edit Reward Catalog Item"
                onClose={() => setIsEditing(false)}
                onSubmit={handleSave}
                busy={busy}
                size="lg"
            >
                <FormSection title="Catalog Item Properties">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Reward Title" required className="md:col-span-2">
                            <input
                                className="form-input"
                                required
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Item Type" required>
                            <select
                                className="form-select"
                                value={form.itemType}
                                onChange={(e) => setForm({ ...form, itemType: e.target.value })}
                            >
                                {ITEM_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Partner Store">
                            <select
                                className="form-select"
                                value={form.partnerStoreId}
                                onChange={(e) => setForm({ ...form, partnerStoreId: e.target.value })}
                            >
                                <option value="">Platform Direct (No Partner)</option>
                                {partners.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.slug})
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Points Cost" required>
                            <input
                                className="form-input"
                                type="number"
                                required
                                min="1"
                                value={form.pointsCost}
                                onChange={(e) => setForm({ ...form, pointsCost: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Monetary Value (₹)" required>
                            <input
                                className="form-input"
                                type="number"
                                required
                                min="0"
                                value={form.monetaryValue}
                                onChange={(e) => setForm({ ...form, monetaryValue: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Stock">
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox"
                                        checked={form.isUnlimitedStock}
                                        onChange={(e) =>
                                            setForm({ ...form, isUnlimitedStock: e.target.checked, stock: '' })
                                        }
                                    />
                                    <span>Unlimited</span>
                                </label>
                                {!form.isUnlimitedStock ? (
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="0"
                                        placeholder="Quantity"
                                        value={form.stock}
                                        onChange={(e) => setForm({ ...form, stock: e.target.value })}
                                    />
                                ) : null}
                            </div>
                        </FormField>
                        <FormField label="Minimum User Tier" required>
                            <select
                                className="form-select"
                                value={form.minUserTier}
                                onChange={(e) => setForm({ ...form, minUserTier: e.target.value })}
                            >
                                {TIERS.map((tier) => (
                                    <option key={tier} value={tier}>
                                        {tier}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Per-User Redemption Limit" required>
                            <input
                                className="form-input"
                                type="number"
                                min="1"
                                required
                                value={form.perUserLimit}
                                onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Voucher Validity (Days)" required>
                            <input
                                className="form-input"
                                type="number"
                                min="1"
                                required
                                value={form.validityDays}
                                onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Image URL" className="md:col-span-2">
                            <input
                                className="form-input"
                                type="url"
                                value={form.imageUrl}
                                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                            />
                        </FormField>
                        <FormField label="Description" className="md:col-span-2">
                            <textarea
                                className="form-textarea"
                                rows={2}
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
