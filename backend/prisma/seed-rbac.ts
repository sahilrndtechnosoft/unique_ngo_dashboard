import {
  permission_action,
  PrismaClient,
} from '../generated/prisma/client';
import {
  ALL_APP_MODULES,
  ALL_PERMISSION_ACTIONS,
  MODULE_LABELS,
  ACTION_LABELS,
} from '../src/common/constants/permissions';

const SYSTEM_ROLES = [
  {
    name: 'Super Admin',
    slug: 'super_admin',
    description: 'Full access to all modules',
    is_system: true,
    allPermissions: true,
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'Administrative access to platform modules',
    is_system: true,
    modules: ALL_APP_MODULES,
    actions: ALL_PERMISSION_ACTIONS,
  },
  {
    name: 'Moderator',
    slug: 'moderator',
    description: 'Read and moderate platform content',
    is_system: true,
    modules: ALL_APP_MODULES.filter((module) => module !== 'ROLES' && module !== 'SETTINGS'),
    actions: ['VIEW', 'EDIT'] as permission_action[],
  },
] as const;

export async function seedRbac(prisma: PrismaClient) {
  const permissionMap = new Map<string, string>();

  for (const module of ALL_APP_MODULES) {
    for (const action of ALL_PERMISSION_ACTIONS) {
      const permission = await prisma.permissions.upsert({
        where: {
          module_action: { module, action },
        },
        create: {
          module,
          action,
          description: `${ACTION_LABELS[action]} ${MODULE_LABELS[module]}`,
        },
        update: {
          description: `${ACTION_LABELS[action]} ${MODULE_LABELS[module]}`,
        },
      });
      permissionMap.set(`${module}:${action}`, permission.id);
    }
  }

  console.log(`Permissions ready: ${permissionMap.size}`);

  for (const roleConfig of SYSTEM_ROLES) {
    const role = await prisma.roles.upsert({
      where: { slug: roleConfig.slug },
      create: {
        name: roleConfig.name,
        slug: roleConfig.slug,
        description: roleConfig.description,
        is_system: roleConfig.is_system,
      },
      update: {
        name: roleConfig.name,
        description: roleConfig.description,
        is_system: roleConfig.is_system,
        is_active: true,
      },
    });

    await prisma.role_permissions.deleteMany({ where: { role_id: role.id } });

    const permissionIds =
      'allPermissions' in roleConfig && roleConfig.allPermissions
        ? [...permissionMap.values()]
        : roleConfig.modules.flatMap((module) =>
            roleConfig.actions.map((action) => permissionMap.get(`${module}:${action}`)!),
          );

    await prisma.role_permissions.createMany({
      data: permissionIds.map((permissionId) => ({
        role_id: role.id,
        permission_id: permissionId,
      })),
      skipDuplicates: true,
    });

    console.log(`Role seeded: ${role.name} (${permissionIds.length} permissions)`);
  }

  return prisma.roles.findUnique({ where: { slug: 'super_admin' } });
}

export async function assignSuperAdminRole(
  prisma: PrismaClient,
  adminEmail: string,
) {
  const superAdminRole = await prisma.roles.findUnique({
    where: { slug: 'super_admin' },
  });

  if (!superAdminRole) {
    return;
  }

  await prisma.users.updateMany({
    where: {
      email: adminEmail.toLowerCase(),
      deleted_at: null,
    },
    data: { rbac_role_id: superAdminRole.id },
  });
}
