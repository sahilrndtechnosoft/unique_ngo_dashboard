import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  seller_status,
  user_role,
  user_status,
  users,
} from '../../generated/prisma/client';
import { compareHash, normalizeMobile } from '../common/utils/crypto.util';
import { UserRole } from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthPortal,
  isRoleAllowedForPortal,
  PORTAL_ALLOWED_ROLES,
} from './constants/auth-portal';
import {
  PublicSellerProfile,
  PublicUserProfile,
  toPublicSeller,
  toPublicUser,
} from './mappers/user.mapper';
import { OtpService } from './services/otp.service';
import { TokenService } from './services/token.service';
import { SessionMetadata } from './dto/device-info.dto';

export interface AuthLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUserProfile;
  sellerProfile?: PublicSellerProfile;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
  ) {}

  async sendOtp(mobileNumber: string, portal: AuthPortal) {
    const mobile = normalizeMobile(mobileNumber);

    if (portal === AuthPortal.ADMIN) {
      const user = await this.prisma.users.findFirst({
        where: {
          mobile,
          deleted_at: null,
          role: { in: PORTAL_ALLOWED_ROLES[portal] as user_role[] },
        },
      });

      if (!user) {
        return {};
      }
    }

    return this.otpService.sendOtp(mobile);
  }

  async verifyOtp(
    mobileNumber: string,
    otp: string,
    portal: AuthPortal,
    metadata?: SessionMetadata,
  ): Promise<AuthLoginResponse> {
    const mobile = normalizeMobile(mobileNumber);
    await this.otpService.verifyOtp(mobile, otp);

    let user = await this.prisma.users.findFirst({
      where: { mobile, deleted_at: null },
    });

    if (!user && portal === AuthPortal.USER) {
      user = await this.registerUser(mobile);
    }

    if (!user && portal === AuthPortal.SELLER) {
      user = await this.registerSeller(mobile);
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials for this portal');
    }

    if (
      portal === AuthPortal.SELLER &&
      !isRoleAllowedForPortal(user.role as UserRole, AuthPortal.SELLER)
    ) {
      throw new ConflictException(
        'This mobile is already registered with a different account type. Use another number for seller registration.',
      );
    }

    if (portal === AuthPortal.SELLER) {
      await this.ensureSellerProfile(user.id, mobile);
    }

    await this.ensureUserAllowedForPortal(user, portal);

    user = await this.prisma.users.update({
      where: { id: user.id },
      data: {
        mobile_verified: true,
        status:
          user.status === user_status.PENDING_VERIFICATION
            ? user_status.ACTIVE
            : user.status,
      },
    });

    return this.buildLoginResponse(user, portal, metadata);
  }

  async loginWithEmail(
    email: string,
    password: string,
    portal: AuthPortal,
    metadata?: SessionMetadata,
  ): Promise<AuthLoginResponse> {
    const user = await this.prisma.users.findFirst({
      where: { email: email.toLowerCase(), deleted_at: null },
    });

    if (!user?.password_hash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.ensureUserAllowedForPortal(user, portal);

    const isPasswordValid = await compareHash(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildLoginResponse(user, portal, metadata);
  }

  async refreshToken(refreshToken: string, metadata?: SessionMetadata) {
    const tokens = await this.tokenService.rotateRefreshToken(
      refreshToken,
      metadata,
    );
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(refreshToken: string, metadata?: SessionMetadata) {
    await this.tokenService.revokeRefreshToken(refreshToken, {
      revokedByIp: metadata?.ipAddress,
      reason: 'logout',
    });
  }

  async logoutAllDevices(userId: string, metadata?: SessionMetadata) {
    const result = await this.tokenService.revokeAllUserSessions(userId, {
      revokedByIp: metadata?.ipAddress,
      reason: 'logout_all',
    });
    return { revokedCount: result.revokedCount };
  }

  async getActiveSessions(userId: string) {
    return this.tokenService.getActiveSessions(userId);
  }

  private async buildLoginResponse(
    user: users,
    portal: AuthPortal,
    metadata?: SessionMetadata,
  ): Promise<AuthLoginResponse> {
    const tokens = await this.tokenService.generateTokenPair(
      {
        id: user.id,
        role: user.role,
        email: user.email,
        mobile: user.mobile,
      },
      metadata,
    );

    const response: AuthLoginResponse = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: toPublicUser(user),
    };

    if (portal === AuthPortal.SELLER) {
      const sellerProfile = await this.prisma.seller_profiles.findFirst({
        where: { user_id: user.id, deleted_at: null },
      });
      if (sellerProfile) {
        response.sellerProfile = toPublicSeller(sellerProfile);
      }
    }

    return response;
  }

  private async ensureUserAllowedForPortal(
    user: users,
    portal: AuthPortal,
  ): Promise<void> {
    if (
      user.status === user_status.SUSPENDED ||
      user.status === user_status.BANNED
    ) {
      throw new ForbiddenException('Your account has been suspended');
    }

    if (user.status === user_status.INACTIVE) {
      throw new ForbiddenException('Your account is inactive');
    }

    if (!isRoleAllowedForPortal(user.role as UserRole, portal)) {
      throw new ForbiddenException(
        `Access denied. This account cannot login to the ${portal} portal`,
      );
    }
  }

  private async registerUser(mobile: string): Promise<users> {
    return this.prisma.users.create({
      data: {
        mobile,
        mobile_verified: true,
        full_name: `User ${mobile.slice(-4)}`,
        role: user_role.USER,
        status: user_status.ACTIVE,
      },
    });
  }

  private async registerSeller(mobile: string): Promise<users> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          mobile,
          mobile_verified: true,
          full_name: `Seller ${mobile.slice(-4)}`,
          role: user_role.SELLER,
          status: user_status.ACTIVE,
        },
      });

      await tx.seller_profiles.create({
        data: {
          user_id: user.id,
          business_name: `Seller ${mobile.slice(-4)}`,
          status: seller_status.ACTIVE,
        },
      });

      return user;
    });
  }

  private async ensureSellerProfile(userId: string, mobile: string): Promise<void> {
    const profile = await this.prisma.seller_profiles.findFirst({
      where: { user_id: userId, deleted_at: null },
    });

    if (!profile) {
      await this.prisma.seller_profiles.create({
        data: {
          user_id: userId,
          business_name: `Seller ${mobile.slice(-4)}`,
          status: seller_status.ACTIVE,
        },
      });
    }
  }
}
