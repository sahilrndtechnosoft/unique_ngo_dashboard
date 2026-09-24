/** CSV cells must remain text when opened by a spreadsheet. */
export function csvCell(value: unknown): string {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
}
export function matchesTableFilter(value: string, query: string, operator: string): boolean {
    if (!query) return true;
    if (operator === 'equals') return value.toLowerCase() === query.toLowerCase();
    if (operator === 'min' || operator === 'max') {
        const left = Number(value.replace(/[,₹]/g, ''));
        const right = Number(query);
        return Number.isFinite(left) && Number.isFinite(right) && (operator === 'min' ? left >= right : left <= right);
    }
    if (operator === 'after' || operator === 'before') {
        const left = Date.parse(value), right = Date.parse(query);
        return Number.isFinite(left) && Number.isFinite(right) && (operator === 'after' ? left >= right : left <= right);
    }
    return value.toLowerCase().includes(query.toLowerCase());
}
