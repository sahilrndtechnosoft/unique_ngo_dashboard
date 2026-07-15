import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { permissions, roles } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignRolePermissionsDto } from '../dto/assign-role-permissions.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles() {
    const roleList = await this.prisma.roles.findMany({
      orderBy: [{ is_system: 'desc' }, { name: 'asc' }],
      include: {
        role_permissions: {
          include: { permission: true },
        },
        _count: { select: { users: true } },
      },
    });

    return roleList.map((role) => this.toPublicRole(role));
  }

  async getRole(roleId: string) {
    const role = await this.findRoleOrThrow(roleId);
    return this.toPublicRole(role);
  }

  async createRole(dto: CreateRoleDto) {
    const slug = slugify(dto.slug ?? dto.name);
    await this.ensureSlugAvailable(slug);

    const permissionIds = await this.resolvePermissionIds(dto.permissionIds);

    const role = await this.prisma.roles.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim(),
        is_system: false,
        role_permissions: permissionIds.length
          ? {
              create: permissionIds.map((permissionId) => ({
                permission_id: permissionId,
              })),
            }
          : undefined,
      },
      include: {
        role_permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    return this.toPublicRole(role);
  }

  async updateRole(roleId: string, dto: UpdateRoleDto) {
    const role = await this.findRoleOrThrow(roleId);

    if (dto.slug && dto.slug !== role.slug) {
      await this.ensureSlugAvailable(slugify(dto.slug), roleId);
    }

    const updated = await this.prisma.roles.update({
      where: { id: roleId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.slug !== undefined && { slug: slugify(dto.slug) }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() ?? null,
        }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
      },
      include: {
        role_permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    if (dto.permissionIds) {
      return this.replaceRolePermissions(roleId, {
        permissionIds: dto.permissionIds,
      });
    }

    return this.toPublicRole(updated);
  }

  async assignPermissions(roleId: string, dto: AssignRolePermissionsDto) {
    return this.replaceRolePermissions(roleId, dto);
  }

  async deleteRole(roleId: string) {
    const role = await this.findRoleOrThrow(roleId);

    if (role.is_system) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    const assignedUsers = await this.prisma.users.count({
      where: { rbac_role_id: roleId, deleted_at: null },
    });

    if (assignedUsers > 0) {
      throw new ConflictException(
        'Role is assigned to users. Reassign them before deleting this role.',
      );
    }

    await this.prisma.roles.delete({ where: { id: roleId } });
  }

  async assignRoleToUser(userId: string, roleId: string | null) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (roleId) {
      await this.findRoleOrThrow(roleId);
    }

    const updated = await this.prisma.users.update({
      where: { id: userId },
      data: { rbac_role_id: roleId },
      include: { rbac_role: true },
    });

    return {
      userId: updated.id,
      fullName: updated.full_name,
      email: updated.email,
      role: updated.role,
      rbacRole: updated.rbac_role
        ? {
            id: updated.rbac_role.id,
            name: updated.rbac_role.name,
            slug: updated.rbac_role.slug,
          }
        : null,
    };
  }

  private async replaceRolePermissions(
    roleId: string,
    dto: AssignRolePermissionsDto,
  ) {
    await this.findRoleOrThrow(roleId);
    const permissionIds = await this.resolvePermissionIds(dto.permissionIds);

    await this.prisma.$transaction([
      this.prisma.role_permissions.deleteMany({ where: { role_id: roleId } }),
      ...permissionIds.map((permissionId) =>
        this.prisma.role_permissions.create({
          data: { role_id: roleId, permission_id: permissionId },
        }),
      ),
    ]);

    return this.getRole(roleId);
  }

  private async resolvePermissionIds(permissionIds?: string[]) {
    if (!permissionIds?.length) {
      return [];
    }

    const uniqueIds = [...new Set(permissionIds)];
    const permissions = await this.prisma.permissions.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });

    if (permissions.length !== uniqueIds.length) {
      throw new BadRequestException('One or more permission IDs are invalid');
    }

    return uniqueIds;
  }

  private async ensureSlugAvailable(slug: string, excludeRoleId?: string) {
    const existing = await this.prisma.roles.findFirst({
      where: {
        slug,
        ...(excludeRoleId ? { NOT: { id: excludeRoleId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(`Role slug "${slug}" is already in use`);
    }
  }

  private async findRoleOrThrow(roleId: string) {
    const role = await this.prisma.roles.findUnique({
      where: { id: roleId },
      include: {
        role_permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  private toPublicRole(
    role: roles & {
      role_permissions: Array<{ permission: permissions }>;
      _count: { users: number };
    },
  ) {
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.is_system,
      isActive: role.is_active,
      userCount: role._count.users,
      permissions: role.role_permissions.map((entry) => ({
        id: entry.permission.id,
        module: entry.permission.module,
        action: entry.permission.action,
        description: entry.permission.description,
        key: `${entry.permission.module}:${entry.permission.action}`,
      })),
      createdAt: role.created_at,
      updatedAt: role.updated_at,
    };
  }
}
