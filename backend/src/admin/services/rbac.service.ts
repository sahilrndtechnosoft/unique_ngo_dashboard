import { Injectable } from '@nestjs/common';
import { UserRole } from '../../common/constants';
import {
  ACTION_LABELS,
  ALL_APP_MODULES,
  ALL_PERMISSION_ACTIONS,
  AppModule,
  buildPermissionKey,
  MODULE_LABELS,
  PermissionAction,
  UserPermission,
} from '../../common/constants/permissions';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
      include: {
        rbac_role: {
          include: {
            role_permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user?.rbac_role?.is_active) {
      return [];
    }

    return user.rbac_role.role_permissions.map((entry) => ({
      module: entry.permission.module as AppModule,
      action: entry.permission.action as PermissionAction,
      key: buildPermissionKey(
        entry.permission.module as AppModule,
        entry.permission.action as PermissionAction,
      ),
    }));
  }

  async getUserPermissionsSummary(userId: string, role: UserRole) {
    const permissions = await this.getUserPermissions(userId);
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;

    return {
      role,
      isSuperAdmin,
      permissions: isSuperAdmin ? this.getAllPermissionKeys() : permissions,
      grouped: isSuperAdmin
        ? this.getGroupedPermissionsCatalog()
        : this.groupPermissions(permissions),
    };
  }

  getGroupedPermissionsCatalog() {
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

  groupPermissions(permissions: UserPermission[]) {
    const grouped = new Map<AppModule, UserPermission[]>();

    for (const permission of permissions) {
      const existing = grouped.get(permission.module) ?? [];
      existing.push(permission);
      grouped.set(permission.module, existing);
    }

    return Array.from(grouped.entries()).map(([module, modulePermissions]) => ({
      module,
      label: MODULE_LABELS[module],
      actions: modulePermissions.map((permission) => ({
        action: permission.action,
        label: ACTION_LABELS[permission.action],
        key: permission.key,
      })),
    }));
  }

  private getAllPermissionKeys(): UserPermission[] {
    const permissions: UserPermission[] = [];

    for (const module of ALL_APP_MODULES) {
      for (const action of ALL_PERMISSION_ACTIONS) {
        permissions.push({
          module,
          action,
          key: buildPermissionKey(module, action),
        });
      }
    }

    return permissions;
  }
}
