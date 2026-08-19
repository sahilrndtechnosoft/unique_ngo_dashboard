import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setPageTitle } from '../../store/themeConfigSlice';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage, mediaUrl } from '../../services/api';
import { AdminDataTable } from '../../components/Admin/AdminTable';
import { RowActionsMenu, StatusBadge } from '../../components/Admin/FormPrimitives';
import { showAlert } from '../../utils/alerts';
import IconArrowLeft from '../../components/Icon/IconArrowLeft';

export default function CategoryDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [category, setCategory] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [products, setProducts] = useState<any[]>([]);
    const [productsMeta, setProductsMeta] = useState({ page: 1, total: 0, totalPages: 1 });
    const [productsPageSize, setProductsPageSize] = useState(10);
    const [productsLoading, setProductsLoading] = useState(false);

    const loadCategory = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const data = (await adminApi.getCategory(id)) as any;
            setCategory(data);
            dispatch(setPageTitle(data.name || 'Category Detail'));
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            showAlert(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadProducts = async (page = 1, size = productsPageSize) => {
        if (!id) return;
        setProductsLoading(true);
        try {
            const data = await adminApi.listProducts({ categoryId: id, page, limit: size });
            setProducts(data.items ?? []);
            setProductsMeta(data.meta);
        } catch (err) {
            showAlert(getErrorMessage(err, 'Failed to load products'), 'error');
        } finally {
            setProductsLoading(false);
        }
    };

    useEffect(() => {
        loadCategory();
        loadProducts(1, productsPageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const infoCards = useMemo(() => {
        if (!category) return [];
        return [
            { label: 'Slug', value: category.slug },
            { label: 'Sort Order', value: category.sortOrder ?? 0 },
            { label: 'Status', value: category.isActive ? 'ACTIVE' : 'INACTIVE' },
            { label: 'Featured', value: category.isFeatured ? 'Yes' : 'No' },
            { label: 'Commission Rate', value: category.commissionRate != null ? `${category.commissionRate}%` : '—' },
            { label: 'Products', value: productsMeta.total },
        ];
    }, [category, productsMeta.total]);

    if (loading) {
        return <div className="panel">Loading category...</div>;
    }

    if (!category) {
        return (
            <div className="panel">
                <p className="text-danger mb-4">{error || 'Category not found'}</p>
                <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/admin/categories')}>
                    Back to categories
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-start gap-3">
                    <Link to="/admin/categories" className="btn btn-outline-primary p-2 mt-0.5" aria-label="Back">
                        <IconArrowLeft className="w-4.5 h-4.5" />
                    </Link>
                    <div className="flex items-center gap-3">
                        {category.imageUrl ? (
                            <img src={mediaUrl(category.imageUrl)} alt={category.name} className="h-12 w-12 rounded object-cover" />
                        ) : null}
                        <div>
                            <h2 className="text-xl font-semibold dark:text-white-light">{category.name}</h2>
                            <p className="text-white-dark text-sm mt-1">{category.description || 'Category detail and assigned products'}</p>
                        </div>
                    </div>
                </div>
                <StatusBadge status={category.isActive ? 'ACTIVE' : 'INACTIVE'} />
            </div>

            <div className="panel mb-5">
                <h5 className="font-semibold text-lg mb-4">Category information</h5>
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
                <h5 className="font-semibold text-lg">Products in this Category</h5>
            </div>

            <AdminDataTable
                selectable={false}
                columns={[
                    {
                        key: 'name',
                        label: 'Product',
                        render: (row) => (
                            <div>
                                <div className="font-semibold">{row.name}</div>
                                <div className="text-xs text-white-dark">{row.sku || '—'}</div>
                            </div>
                        ),
                    },
                    { key: 'price', label: 'Price', render: (row) => `₹${row.price}` },
                    { key: 'stockQuantity', label: 'Stock', render: (row) => row.stockQuantity },
                    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                ]}
                rows={products}
                loading={productsLoading}
                page={productsMeta.page}
                totalPages={productsMeta.totalPages}
                total={productsMeta.total}
                pageSize={productsPageSize}
                onPageChange={(page) => loadProducts(page, productsPageSize)}
                onPageSizeChange={(size) => {
                    setProductsPageSize(size);
                    loadProducts(1, size);
                }}
                actions={(row) => <RowActionsMenu actions={[{ label: 'View', onClick: () => navigate(`/admin/products/${row.id}`) }]} />}
                emptyText="No products assigned to this category"
            />
        </div>
    );
}
