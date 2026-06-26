import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  user_role,
  user_status,
} from '../../generated/prisma/client';
import {
  canAssignRole,
  getAssignableRoles,
  getPermissionsForRole,
  UserRole,
} from '../common/constants';
import { hashValue, normalizeMobile } from '../common/utils/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminCreateUserDto,
  AdminUpdateUserDto,
  ListUsersQueryDto,
} from './dto/admin-user.dto';
import { PublicUserProfile, UsersService } from './users.service';

export interface PaginatedUsers {
  items: PublicUserProfile[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  getRolePermissions(actorRole: UserRole) {
    return {
      role: actorRole,
      permissions: getPermissionsForRole(actorRole),
      assignableRoles: getAssignableRoles(actorRole),
    };
  }

  async listUsers(query: ListUsersQueryDto): Promise<PaginatedUsers> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      deleted_at: null,
      ...(query.role && { role: query.role }),
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { full_name: { contains: query.search, mode: 'insensitive' as const } },
          { email: { contains: query.search, mode: 'insensitive' as const } },
          { mobile: { contains: query.search } },
        ],
      }),
    };

    const [total, usersList] = await Promise.all([
      this.prisma.users.count({ where }),
      this.prisma.users.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      items: usersList.map((user) => this.usersService.toPublicProfile(user)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getUserById(userId: string): Promise<PublicUserProfile> {
    return this.usersService.getProfile(userId);
  }

  async createUser(
    dto: AdminCreateUserDto,
    actorRole: UserRole,
  ): Promise<PublicUserProfile> {
    if (!dto.email && !dto.mobile) {
      throw new BadRequestException('Either email or mobile is required');
    }

    const targetRole = (dto.role ?? user_role.USER) as UserRole;
    this.assertCanAssignRole(actorRole, targetRole);

    const email = dto.email?.toLowerCase();
    const mobile = dto.mobile ? normalizeMobile(dto.mobile) : undefined;

    await this.assertUniqueEmailAndMobile(email, mobile);

    const bcryptRounds = this.configService.get<number>('app.bcryptRounds')!;
    const passwordHash = dto.password
      ? await hashValue(dto.password, bcryptRounds)
      : undefined;

    const user = await this.prisma.users.create({
      data: {
        full_name: dto.fullName,
        email,
        mobile,
        password_hash: passwordHash,
        role: targetRole as user_role,
        status: dto.status ?? user_status.ACTIVE,
        blood_group: dto.bloodGroup,
        email_verified: !!email,
        mobile_verified: !!mobile,
      },
    });

    return this.usersService.toPublicProfile(user);
  }

  async updateUser(
    userId: string,
    dto: AdminUpdateUserDto,
    actorId: string,
    actorRole: UserRole,
  ): Promise<PublicUserProfile> {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.role !== undefined) {
      this.assertCanAssignRole(actorRole, dto.role as UserRole);

      if (
        user.id === actorId &&
        (dto.role as UserRole) !== (user.role as UserRole)
      ) {
        throw new ForbiddenException('You cannot change your own role');
      }
    }

    if (dto.status === user_status.BANNED || dto.status === user_status.SUSPENDED) {
      if (user.id === actorId) {
        throw new ForbiddenException('You cannot suspend or ban your own account');
      }

      if (
        user.role === user_role.SUPER_ADMIN &&
        actorRole !== UserRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException('Only super admin can modify super admin accounts');
      }
    }

    const email =
      dto.email !== undefined ? dto.email.toLowerCase() : undefined;
    const mobile =
      dto.mobile !== undefined ? normalizeMobile(dto.mobile) : undefined;

    if (email || mobile) {
      await this.assertUniqueEmailAndMobile(email, mobile, userId);
    }

    const bcryptRounds = this.configService.get<number>('app.bcryptRounds')!;
    const passwordHash = dto.password
      ? await hashValue(dto.password, bcryptRounds)
      : undefined;

    const updatedUser = await this.prisma.users.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined && { full_name: dto.fullName }),
        ...(email !== undefined && { email }),
        ...(mobile !== undefined && { mobile }),
        ...(passwordHash && { password_hash: passwordHash }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.bloodGroup !== undefined && { blood_group: dto.bloodGroup }),
        ...(dto.mobileVerified !== undefined && {
          mobile_verified: dto.mobileVerified,
        }),
        ...(dto.emailVerified !== undefined && {
          email_verified: dto.emailVerified,
        }),
      },
    });

    const defaultAddress = await this.prisma.user_addresses.findFirst({
      where: { user_id: userId, deleted_at: null, is_default: true },
    });

    return this.usersService.toPublicProfile(updatedUser, defaultAddress);
  }

  async deleteUser(
    userId: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<void> {
    if (userId === actorId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      user.role === user_role.SUPER_ADMIN &&
      actorRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Only super admin can delete super admin accounts');
    }

    await this.prisma.users.update({
      where: { id: userId },
      data: { deleted_at: new Date(), status: user_status.INACTIVE },
    });

    await this.prisma.auth_sessions.updateMany({
      where: { user_id: userId, is_active: true },
      data: { is_active: false, revoked_at: new Date() },
    });
  }

  private assertCanAssignRole(actorRole: UserRole, targetRole: UserRole): void {
    if (!canAssignRole(actorRole, targetRole)) {
      throw new ForbiddenException(
        `Your role cannot assign the ${targetRole} role`,
      );
    }
  }

  private async assertUniqueEmailAndMobile(
    email?: string,
    mobile?: string,
    excludeUserId?: string,
  ): Promise<void> {
    if (email) {
      const existingEmail = await this.prisma.users.findFirst({
        where: {
          email,
          deleted_at: null,
          ...(excludeUserId && { NOT: { id: excludeUserId } }),
        },
      });

      if (existingEmail) {
        throw new ConflictException('Email is already in use');
      }
    }

    if (mobile) {
      const existingMobile = await this.prisma.users.findFirst({
        where: {
          mobile,
          deleted_at: null,
          ...(excludeUserId && { NOT: { id: excludeUserId } }),
        },
      });

      if (existingMobile) {
        throw new ConflictException('Mobile number is already in use');
      }
    }
  }
}
