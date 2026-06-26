import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { otp_purpose, user_role, user_status } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  addMinutes,
  compareHash,
  generateSecureToken,
  hashValue,
  normalizeMobile,
} from '../common/utils/crypto.util';
import { EmailService } from './services/email.service';
import { OtpService } from './services/otp.service';
import { TokenService } from './services/token.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
  ) {}

  async sendOtp(mobileNumber: string): Promise<{ otp?: string }> {
    return this.otpService.sendOtp(mobileNumber, otp_purpose.LOGIN);
  }

  async verifyOtp(
    mobileNumber: string,
    otp: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const mobile = normalizeMobile(mobileNumber);
    await this.otpService.verifyOtp(mobile, otp, otp_purpose.LOGIN);

    let user = await this.prisma.users.findFirst({
      where: { mobile, deleted_at: null },
    });

    if (!user) {
      user = await this.prisma.users.create({
        data: {
          mobile,
          mobile_verified: true,
          full_name: `User ${mobile.slice(-4)}`,
          role: user_role.USER,
          status: user_status.ACTIVE,
        },
      });
    } else {
      this.ensureUserCanLogin(user.status);

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
    }

    const tokens = await this.tokenService.generateTokenPair(
      {
        id: user.id,
        role: user.role,
        email: user.email,
        mobile: user.mobile,
      },
      metadata,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.usersService.toPublicProfile(user),
    };
  }

  async loginWithEmail(
    email: string,
    password: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.prisma.users.findFirst({
      where: { email: email.toLowerCase(), deleted_at: null },
    });

    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.ensureUserCanLogin(user.status);

    const isPasswordValid = await compareHash(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.tokenService.generateTokenPair(
      {
        id: user.id,
        role: user.role,
        email: user.email,
        mobile: user.mobile,
      },
      metadata,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.usersService.toPublicProfile(user),
    };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.users.findFirst({
      where: { email: email.toLowerCase(), deleted_at: null },
    });

    if (!user) {
      return;
    }

    const resetToken = generateSecureToken();
    const bcryptRounds = this.configService.get<number>('app.bcryptRounds')!;
    const tokenHash = await hashValue(resetToken, bcryptRounds);

    await this.prisma.password_reset_tokens.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: addMinutes(new Date(), 60),
      },
    });

    await this.emailService.sendPasswordResetEmail(user.email!, resetToken);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const bcryptRounds = this.configService.get<number>('app.bcryptRounds')!;
    const now = new Date();

    const tokens = await this.prisma.password_reset_tokens.findMany({
      where: {
        is_used: false,
        expires_at: { gt: now },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    let matchedToken: (typeof tokens)[number] | null = null;

    for (const record of tokens) {
      const isMatch = await compareHash(token, record.token_hash);
      if (isMatch) {
        matchedToken = record;
        break;
      }
    }

    if (!matchedToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await hashValue(password, bcryptRounds);

    await this.prisma.$transaction([
      this.prisma.users.update({
        where: { id: matchedToken.user_id },
        data: { password_hash: passwordHash },
      }),
      this.prisma.password_reset_tokens.update({
        where: { id: matchedToken.id },
        data: { is_used: true, used_at: now },
      }),
    ]);
  }

  async refreshToken(
    refreshToken: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
    const tokens = await this.tokenService.refreshTokens(refreshToken, metadata);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(refreshToken);
  }

  private ensureUserCanLogin(status: user_status): void {
    if (
      status === user_status.SUSPENDED ||
      status === user_status.BANNED ||
      status === user_status.INACTIVE
    ) {
      throw new UnauthorizedException('Your account is not allowed to login');
    }
  }
}
