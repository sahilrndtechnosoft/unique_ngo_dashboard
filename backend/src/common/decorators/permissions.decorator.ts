import { SetMetadata } from '@nestjs/common';
import {
  AppModule,
  PermissionAction,
  PermissionRequirement,
} from '../constants/permissions';

export const PERMISSIONS_KEY = 'permissions';
export const ROLES_KEY = 'roles';

export const RequirePermissions = (
  module: AppModule,
  action: PermissionAction,
) => SetMetadata(PERMISSIONS_KEY, { module, action } satisfies PermissionRequirement);

export const RequireAnyPermission = (...requirements: PermissionRequirement[]) =>
  SetMetadata(PERMISSIONS_KEY, requirements);

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
