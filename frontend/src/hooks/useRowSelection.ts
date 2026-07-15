import { useCallback, useEffect, useMemo, useState } from 'react';

export function useRowSelection(itemIds: string[]) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        setSelectedIds((prev) => prev.filter((id) => itemIds.includes(id)));
    }, [itemIds]);

    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const allSelected = itemIds.length > 0 && itemIds.every((id) => selectedSet.has(id));
    const someSelected = selectedIds.length > 0 && !allSelected;

    const toggle = useCallback((id: string) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }, []);

    const toggleAll = useCallback(() => {
        setSelectedIds((prev) => (itemIds.every((id) => prev.includes(id)) ? [] : [...itemIds]));
    }, [itemIds]);

    const clear = useCallback(() => setSelectedIds([]), []);

    return { selectedIds, selectedSet, allSelected, someSelected, toggle, toggleAll, clear, setSelectedIds };
}
