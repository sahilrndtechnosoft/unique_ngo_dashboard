import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { JwtPayload } from '../../common/constants';
import {
  addDays,
  compareHash,
  hashValue,
  parseDurationToDays,
} from '../../common/utils/crypto.util';
import { PrismaService } from '../../prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async generateTokenPair(
    user: {
      id: string;
      role: string;
      email?: string | null;
      mobile?: string | null;
    },
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      deviceId?: string;
    },
  ): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role as JwtPayload['role'],
      email: user.email,
      mobile: user.mobile,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('app.jwt.accessSecret'),
      expiresIn: this.configService.get<string>(
        'app.jwt.accessExpiresIn',
      )! as `${number}m`,
    });

    const refreshSecret = randomBytes(48).toString('hex');
    const bcryptRounds = this.configService.get<number>('app.bcryptRounds')!;
    const refreshTokenHash = await hashValue(refreshSecret, bcryptRounds);
    const refreshExpiresIn = this.configService.get<string>(
      'app.jwt.refreshExpiresIn',
    )!;
    const refreshDays = parseDurationToDays(refreshExpiresIn);

    const session = await this.prisma.auth_sessions.create({
      data: {
        user_id: user.id,
        refresh_token_hash: refreshTokenHash,
        device_id: metadata?.deviceId,
        ip_address: metadata?.ipAddress,
        user_agent: metadata?.userAgent,
        expires_at: addDays(new Date(), refreshDays),
      },
    });

    const refreshToken = `${session.id}.${refreshSecret}`;

    return { accessToken, refreshToken };
  }

  async refreshTokens(
    refreshToken: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const sessionId = this.extractSessionId(refreshToken);
    const refreshSecret = this.extractRefreshSecret(refreshToken);

    const session = await this.prisma.auth_sessions.findFirst({
      where: {
        id: sessionId,
        is_active: true,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const isMatch = await compareHash(refreshSecret, session.refresh_token_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.users.findFirst({
      where: {
        id: session.user_id,
        deleted_at: null,
        status: { notIn: ['SUSPENDED', 'BANNED', 'INACTIVE'] },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account is not active');
    }

    await this.prisma.auth_sessions.update({
      where: { id: session.id },
      data: {
        is_active: false,
        revoked_at: new Date(),
      },
    });

    return this.generateTokenPair(
      {
        id: user.id,
        role: user.role,
        email: user.email,
        mobile: user.mobile,
      },
      metadata,
    );
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const sessionId = this.extractSessionId(refreshToken);
    const refreshSecret = this.extractRefreshSecret(refreshToken);

    const session = await this.prisma.auth_sessions.findFirst({
      where: {
        id: sessionId,
        is_active: true,
        revoked_at: null,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isMatch = await compareHash(refreshSecret, session.refresh_token_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.auth_sessions.update({
      where: { id: session.id },
      data: {
        is_active: false,
        revoked_at: new Date(),
      },
    });
  }

  private extractSessionId(refreshToken: string): string {
    const separatorIndex = refreshToken.indexOf('.');
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Invalid refresh token format');
    }
    return refreshToken.slice(0, separatorIndex);
  }

  private extractRefreshSecret(refreshToken: string): string {
    const separatorIndex = refreshToken.indexOf('.');
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Invalid refresh token format');
    }
    return refreshToken.slice(separatorIndex + 1);
  }
}
