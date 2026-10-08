import { ExecutionContext } from '@nestjs/common';

export function shouldSkipRateLimit(context: ExecutionContext): boolean {
  return isAdminDashboardRequest(context.switchToHttp().getRequest());
}

export function isAdminDashboardRequest(request: { originalUrl?: string; url?: string; path?: string }): boolean {
  const path = (request.originalUrl ?? request.url ?? request.path ?? '').split('?')[0];
  return path === '/api/v1/admin' || path.startsWith('/api/v1/admin/') || path === '/admin' || path.startsWith('/admin/');
}
