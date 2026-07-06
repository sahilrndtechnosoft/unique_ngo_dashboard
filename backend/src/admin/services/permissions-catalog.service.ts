import { Injectable } from '@nestjs/common';
import {
  ACTION_LABELS,
  ALL_APP_MODULES,
  ALL_PERMISSION_ACTIONS,
  MODULE_LABELS,
  buildPermissionKey,
} from '../../common/constants/permissions';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  getCatalog() {
    return ALL_APP_MODULES.map((module) => ({
      module,
      label: MODULE_LABELS[module],
      actions: ALL_PERMISSION_ACTIONS.map((action) => ({
        action,
        label: ACTION_LABELS[action],
        key: buildPermissionKey(module, action),
      })),
    }));
  }

  async listPermissions() {
    const permissions = await this.prisma.permissions.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    const grouped = new Map<string, typeof permissions>();

    for (const permission of permissions) {
      const existing = grouped.get(permission.module) ?? [];
      existing.push(permission);
      grouped.set(permission.module, existing);
    }

    return Array.from(grouped.entries()).map(([module, modulePermissions]) => ({
      module,
      label: MODULE_LABELS[module as keyof typeof MODULE_LABELS] ?? module,
      permissions: modulePermissions.map((permission) => ({
        id: permission.id,
        module: permission.module,
        action: permission.action,
        description: permission.description,
        key: `${permission.module}:${permission.action}`,
        label: `${ACTION_LABELS[permission.action as keyof typeof ACTION_LABELS]} ${MODULE_LABELS[module as keyof typeof MODULE_LABELS] ?? module}`,
      })),
    }));
  }
}
