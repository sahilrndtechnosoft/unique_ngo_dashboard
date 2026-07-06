import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../constants';
import {
  PermissionRequirement,
  UserPermission,
} from '../constants/permissions';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RbacService } from '../../admin/services/rbac.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<
      PermissionRequirement | PermissionRequirement[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: { sub: string; role: UserRole } }>();
    const user = request.user;

    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    const permissions = await this.rbacService.getUserPermissions(user.sub);
    const requirements = Array.isArray(requirement) ? requirement : [requirement];

    const hasPermission = requirements.some((req) =>
      this.matchPermission(permissions, req),
    );

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }

  private matchPermission(
    permissions: UserPermission[],
    requirement: PermissionRequirement,
  ): boolean {
    return permissions.some(
      (permission) =>
        permission.module === requirement.module &&
        permission.action === requirement.action,
    );
  }
}
