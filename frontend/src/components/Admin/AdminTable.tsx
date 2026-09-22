import { ReactNode, useMemo, useState } from 'react';
import IconPlus from '../Icon/IconPlus';
import IconSearch from '../Icon/IconSearch';
import IconTrash from '../Icon/IconTrash';
import IconX from '../Icon/IconX';
import IconCaretDown from '../Icon/IconCaretDown';

export const PAGE_SIZE_OPTIONS = [10, 20] as const;

interface AdminPageHeaderProps {
    title: string;
    subtitle?: string;
    search: string;
    onSearchChange: (value: string) => void;
    onSearch: () => void;
    onClear: () => void;
    onCreate?: () => void;
    createLabel?: string;
    filters?: ReactNode;
    searchPlaceholder?: string;
    canClear?: boolean;
    actions?: ReactNode;
}

export function AdminPageHeader({
    title,
    subtitle,
    search,
    onSearchChange,
    onSearch,
    onClear,
    onCreate,
    createLabel = 'Create',
    filters,
    searchPlaceholder = 'Search...',
    canClear = false,
    actions,
}: AdminPageHeaderProps) {
    return (
        <div className="admin-page-header mb-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold dark:text-white-light">{title}</h2>
                    {subtitle ? <p className="text-white-dark text-sm mt-1">{subtitle}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                    {actions}
                    {onCreate ? (
                        <button type="button" className="btn btn-primary shrink-0" onClick={onCreate}>
                            <IconPlus className="w-4.5 h-4.5 ltr:mr-1.5 rtl:ml-1.5" />
                            {createLabel}
                        </button>
                    ) : null}
                </div>
            </div>

            <form
                role="search"
                aria-label={`Search and filter ${title}`}
                className="admin-filter-bar panel !py-3 !px-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    onSearch();
                }}
            >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                    <div className="relative w-full min-w-0 flex-1">
                        <span className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-white-dark pointer-events-none">
                            <IconSearch className="w-4 h-4" />
                        </span>
                        <label className="sr-only" htmlFor={`admin-search-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                            Search {title}
                        </label>
                        <input
                            id={`admin-search-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                            type="text"
                            placeholder={searchPlaceholder}
                            className="form-input w-full ltr:pl-9 rtl:pr-9"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                        {filters}
                        <button type="submit" className="btn btn-primary">
                            <IconSearch className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" />
                            Search
                        </button>
                        <button type="button" className="btn btn-outline-dark" onClick={onClear} disabled={!canClear}>
                            <IconX className="w-4 h-4 ltr:mr-1.5 rtl:ml-1.5" />
                            Clear
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

interface BulkActionsBarProps {
    count: number;
    onClear: () => void;
    onBulkDelete?: () => void;
    extra?: ReactNode;
}

export function BulkActionsBar({ count, onClear, onBulkDelete, extra }: BulkActionsBarProps) {
    if (count === 0) return null;

    return (
        <div className="mb-4 panel py-3 px-4 flex flex-wrap items-center justify-between gap-3 bg-primary-light dark:bg-[#1b2e4b]">
            <div className="font-semibold">
                {count} selected
                <button type="button" className="btn btn-sm btn-outline-primary ltr:ml-3 rtl:mr-3" onClick={onClear}>
                    Clear
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {extra}
                {onBulkDelete ? (
                    <button type="button" className="btn btn-sm btn-danger" onClick={onBulkDelete}>
                        <IconTrash className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                        Delete selected
                    </button>
                ) : null}
            </div>
        </div>
    );
}

export interface AdminColumn<T> {
    key: string;
    label: string;
    className?: string;
    sortable?: boolean;
    /** Value used for sorting. Defaults to row[key]. */
    sortValue?: (row: T) => string | number | null | undefined;
    render: (row: T) => ReactNode;
}

export type SortDirection = 'asc' | 'desc';

interface AdminDataTableProps<T extends { id: string }> {
    columns: AdminColumn<T>[];
    rows: T[];
    loading?: boolean;
    selectedIds?: string[];
    allSelected?: boolean;
    someSelected?: boolean;
    onToggleAll?: () => void;
    onToggle?: (id: string) => void;
    selectable?: boolean;
    actions?: (row: T) => ReactNode;
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    emptyText?: string;
}

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined) {
    const left = a ?? '';
    const right = b ?? '';
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}

export function AdminDataTable<T extends { id: string }>({
    columns,
    rows,
    loading,
    selectedIds = [],
    allSelected = false,
    someSelected = false,
    onToggleAll,
    onToggle,
    selectable = true,
    actions,
    page,
    totalPages,
    total,
    pageSize,
    onPageChange,
    onPageSizeChange,
    emptyText = 'No records found',
}: AdminDataTableProps<T>) {
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<SortDirection>('asc');
    const safeRows = Array.isArray(rows) ? rows : [];

    const sortedRows = useMemo(() => {
        if (!sortKey) return safeRows;
        const column = columns.find((col) => col.key === sortKey);
        if (!column?.sortable) return safeRows;
        const getValue = column.sortValue ?? ((row: T) => (row as Record<string, unknown>)[column.key] as string | number);
        const copy = [...safeRows];
        copy.sort((left, right) => {
            const result = compareValues(getValue(left), getValue(right));
            return sortDir === 'asc' ? result : -result;
        });
        return copy;
    }, [safeRows, columns, sortKey, sortDir]);

    const colSpan = columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0);

    const toggleSort = (column: AdminColumn<T>) => {
        if (!column.sortable) return;
        if (sortKey === column.key) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(column.key);
        setSortDir('asc');
    };

    return (
        <div className="admin-data-table panel p-0">
            {loading ? <span className="sr-only" role="status">Loading records</span> : null}
            <div className="overflow-x-auto">
                <table className="table-striped table-hover text-sm" aria-busy={loading}>
                    <thead>
                        <tr>
                            {selectable ? (
                                    <th scope="col" className="!w-12 ltr:!pl-4 rtl:!pr-4 !py-3">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox"
                                        checked={allSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = someSelected;
                                        }}
                                        onChange={onToggleAll}
                                        aria-label="Select all"
                                    />
                                </th>
                            ) : null}
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    scope="col"
                                    className={`!py-3 ${col.className ?? ''}`}
                                    aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                >
                                    {col.sortable ? (
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-1 font-semibold hover:text-primary"
                                            aria-label={`Sort by ${col.label}${sortKey === col.key ? `, ${sortDir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
                                            onClick={() => toggleSort(col)}
                                        >
                                            <span>{col.label}</span>
                                            <IconCaretDown
                                                className={`w-3.5 h-3.5 transition-transform ${
                                                    sortKey === col.key
                                                        ? sortDir === 'asc'
                                                            ? 'rotate-180 opacity-100'
                                                            : 'opacity-100'
                                                        : 'opacity-40'
                                                }`}
                                            />
                                        </button>
                                    ) : (
                                        col.label
                                    )}
                                </th>
                            ))}
                            {actions ? <th scope="col" className="ltr:!text-right rtl:!text-left ltr:!pr-4 rtl:!pl-4 w-16 !py-3">Actions</th> : null}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }, (_, rowIndex) => (
                                <tr key={`loading-${rowIndex}`} aria-hidden="true">
                                    {Array.from({ length: colSpan }, (_, columnIndex) => (
                                        <td key={columnIndex}>
                                            <span className="admin-table-skeleton" style={{ width: `${46 + ((rowIndex + columnIndex) % 4) * 12}%` }} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : sortedRows.length === 0 ? (
                            <tr>
                                <td colSpan={colSpan} className="!py-10 text-white-dark">
                                    <div className="admin-table-empty-state">{emptyText}</div>
                                </td>
                            </tr>
                        ) : (
                            sortedRows.map((row) => (
                                <tr key={row.id} className={selectedIds.includes(row.id) ? 'bg-primary/5' : undefined}>
                                    {selectable ? (
                                        <td className="ltr:!pl-4 rtl:!pr-4 !py-2.5">
                                            <input
                                                type="checkbox"
                                                className="form-checkbox"
                                                checked={selectedIds.includes(row.id)}
                                                onChange={() => onToggle?.(row.id)}
                                                aria-label={`Select ${row.id}`}
                                            />
                                        </td>
                                    ) : null}
                                    {columns.map((col) => (
                                        <td key={col.key} className={`!py-2.5 ${col.className ?? ''}`}>
                                            {col.render(row)}
                                        </td>
                                    ))}
                                    {actions ? <td className="ltr:text-right rtl:text-left ltr:!pr-4 rtl:!pl-4 !py-2.5">{actions(row)}</td> : null}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div className="admin-table-pagination flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[#ebedf2] dark:border-[#191e3a] bg-[#fbfbfb]/70 dark:bg-[#0e1726]/40">
                <div className="flex flex-wrap items-center gap-3 text-sm text-white-dark" aria-live="polite">
                    <span className="admin-table-count">
                        Showing {(total === 0 ? 0 : (page - 1) * pageSize + 1).toLocaleString()}–
                        {Math.min(page * pageSize, total).toLocaleString()} of {total.toLocaleString()}
                    </span>
                    <label className="flex items-center gap-2">
                        <span>Rows per page</span>
                        <select
                            className="form-select py-1.5 w-[90px]"
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                        >
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-white-dark">
                        Page {page} / {Math.max(totalPages, 1)}
                    </span>
                    <button type="button" className="btn btn-sm btn-outline-primary" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                        Prev
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        aria-label="Next page"
                        disabled={page >= totalPages}
                        onClick={() => onPageChange(page + 1)}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
