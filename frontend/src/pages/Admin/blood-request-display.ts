export function bloodRequestUrgencyStatus(request: { urgency?: string | null; isEmergency?: boolean }): string {
    return request.urgency ?? '—';
}
