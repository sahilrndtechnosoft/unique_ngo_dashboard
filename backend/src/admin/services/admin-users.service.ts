import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, user_role, user_status, users } from '../../../generated/prisma/client';
import { hashValue, normalizeMobile } from '../../common/utils/crypto.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateAdminUserDto,
  ListUsersQueryDto,
  UpdateAdminUserDto,
} from '../dto/admin-user.dto';

const STAFF_ACCOUNT_TYPES: user_role[] = [
  user_role.ADMIN,
  user_role.SUPER_ADMIN,
];

function isStaffAccountType(role: user_role): boolean {
  return STAFF_ACCOUNT_TYPES.includes(role);
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async listUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.usersWhereInput = {
      deleted_at: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.rbacRoleId ? { rbac_role_id: query.rbacRoleId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { full_name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { mobile: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.users.count({ where }),
      this.prisma.users.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { rbac_role: true },
      }),
    ]);

    return {
      items: rows.map((user) => this.toPublic(user)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getUser(userId: string) {
    const user = await this.findUserOrThrow(userId);
    return this.toPublic(user);
  }

  async createUser(dto: CreateAdminUserDto) {
    const email = dto.email.toLowerCase();
    await this.ensureEmailAvailable(email);

    const mobile = dto.mobile ? normalizeMobile(dto.mobile) : undefined;
    if (mobile) {
      await this.ensureMobileAvailable(mobile);
    }

    const rbacRoleId = await this.resolveRbacRoleIdForAccountType(
      dto.role,
      dto.rbacRoleId,
    );

    const passwordHash = await hashValue(
      dto.password,
      this.configService.get<number>('app.bcryptRounds')!,
    );

    const user = await this.prisma.users.create({
      data: {
        full_name: dto.fullName,
        email,
        mobile,
        password_hash: passwordHash,
        role: dto.role,
        status: dto.status ?? user_status.ACTIVE,
        email_verified: true,
        mobile_verified: !!mobile,
        rbac_role_id: rbacRoleId,
      },
      include: { rbac_role: true },
    });

    return this.toPublic(user);
  }

  async updateUser(userId: string, dto: UpdateAdminUserDto) {
    const user = await this.findUserOrThrow(userId);

    if (dto.email && dto.email.toLowerCase() !== user.email?.toLowerCase()) {
      await this.ensureEmailAvailable(dto.email.toLowerCase(), userId);
    }

    const mobile = dto.mobile ? normalizeMobile(dto.mobile) : undefined;
    if (mobile && mobile !== user.mobile) {
      await this.ensureMobileAvailable(mobile, userId);
    }

    const nextRole = dto.role ?? user.role;

    if (
      user.role === user_role.SUPER_ADMIN &&
      dto.role &&
      dto.role !== user_role.SUPER_ADMIN
    ) {
      await this.ensureNotLastSuperAdmin(userId);
    }

    let rbacRoleId: string | null | undefined;
    if (dto.role !== undefined || dto.rbacRoleId !== undefined) {
      rbacRoleId = await this.resolveRbacRoleIdForAccountType(
        nextRole,
        dto.rbacRoleId !== undefined ? dto.rbacRoleId : user.rbac_role_id,
      );
    }

    const data: Prisma.usersUpdateInput = {
      ...(dto.fullName !== undefined && { full_name: dto.fullName }),
      ...(dto.email !== undefined && {
        email: dto.email.toLowerCase(),
        email_verified: false,
      }),
      ...(dto.mobile !== undefined && {
        mobile,
        mobile_verified: true,
      }),
      ...(dto.role !== undefined && { role: dto.role }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(rbacRoleId !== undefined && {
        rbac_role: rbacRoleId
          ? { connect: { id: rbacRoleId } }
          : { disconnect: true },
      }),
      updated_at: new Date(),
    };

    if (dto.password) {
      data.password_hash = await hashValue(
        dto.password,
        this.configService.get<number>('app.bcryptRounds')!,
      );
    }

    const updated = await this.prisma.users.update({
      where: { id: userId },
      data,
      include: { rbac_role: true },
    });

    return this.toPublic(updated);
  }

  async deleteUser(userId: string, actorId: string) {
    if (userId === actorId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const user = await this.findUserOrThrow(userId);

    if (user.role === user_role.SUPER_ADMIN) {
      await this.ensureNotLastSuperAdmin(userId);
    }

    await this.prisma.users.update({
      where: { id: userId },
      data: {
        deleted_at: new Date(),
        status: user_status.INACTIVE,
        updated_at: new Date(),
      },
    });
  }

  private async resolveRbacRoleIdForAccountType(
    accountType: user_role,
    rbacRoleId?: string | null,
  ): Promise<string | null> {
    if (!isStaffAccountType(accountType)) {
      return null;
    }

    if (!rbacRoleId) {
      throw new BadRequestException(
        'RBAC role is required for ADMIN and SUPER_ADMIN account types',
      );
    }

    const rbacRole = await this.prisma.roles.findFirst({
      where: { id: rbacRoleId, is_active: true },
    });

    if (!rbacRole) {
      throw new BadRequestException('RBAC role not found or inactive');
    }

    return rbacRole.id;
  }

  private async findUserOrThrow(userId: string) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
      include: { rbac_role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async ensureEmailAvailable(email: string, excludeId?: string) {
    const existing = await this.prisma.users.findFirst({
      where: {
        email,
        deleted_at: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException('Email is already in use');
    }
  }

  private async ensureMobileAvailable(mobile: string, excludeId?: string) {
    const existing = await this.prisma.users.findFirst({
      where: {
        mobile,
        deleted_at: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException('Mobile number is already in use');
    }
  }

  private async ensureNotLastSuperAdmin(userId: string) {
    const count = await this.prisma.users.count({
      where: {
        role: user_role.SUPER_ADMIN,
        deleted_at: null,
        NOT: { id: userId },
      },
    });

    if (count === 0) {
      throw new BadRequestException('Cannot remove the last Super Admin');
    }
  }

  private toPublic(
    user: users & {
      rbac_role?: { id: string; name: string; slug: string } | null;
    },
  ) {
    return {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      status: user.status,
      emailVerified: user.email_verified,
      mobileVerified: user.mobile_verified,
      profilePicture: user.profile_image_url,
      rbacRoleId: user.rbac_role_id,
      rbacRole: user.rbac_role
        ? {
            id: user.rbac_role.id,
            name: user.rbac_role.name,
            slug: user.rbac_role.slug,
          }
        : null,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
}
