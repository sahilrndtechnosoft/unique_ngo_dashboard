import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { auth_sessions, users } from '../../../generated/prisma/client';
import { JwtPayload } from '../../common/constants';
import {
  addDays,
  compareHash,
  hashValue,
  parseDurationToDays,
} from '../../common/utils/crypto.util';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionMetadata } from '../dto/device-info.dto';

export interface TokenUser {
  id: string;
  role: string;
  email?: string | null;
  mobile?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface ValidatedRefreshToken {
  session: auth_sessions;
  user: users;
  rawSecret: string;
}

type RevokeReason =
  | 'logout'
  | 'rotation'
  | 'logout_all'
  | 'reuse_detected'
  | 'admin'
  | 'expired';

interface RevokeSessionOptions {
  revokedByIp?: string;
  replacedBySessionId?: string;
  reason?: RevokeReason;
}

function isSessionExpired(session: auth_sessions): boolean {
  return session.expires_at <= new Date();
}

function isSessionRevoked(session: auth_sessions): boolean {
  return !session.is_active || session.revoked_at !== null;
}

function isSessionActive(session: auth_sessions): boolean {
  return session.is_active && !isSessionRevoked(session) && !isSessionExpired(session);
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  generateAccessToken(user: TokenUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role as JwtPayload['role'],
      email: user.email,
      mobile: user.mobile,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('app.jwt.accessSecret'),
      expiresIn: this.configService.get<string>(
        'app.jwt.accessExpiresIn',
      )! as `${number}m`,
    });
  }

  async generateRefreshToken(
    user: TokenUser,
    metadata?: SessionMetadata,
  ): Promise<{ refreshToken: string; session: auth_sessions }> {
    const refreshSecret = randomBytes(48).toString('hex');
    const refreshTokenHash = await this.hashRefreshSecret(refreshSecret);
    const expiresAt = this.getRefreshTokenExpiryDate();

    const session = await this.prisma.auth_sessions.create({
      data: {
        user_id: user.id,
        refresh_token_hash: refreshTokenHash,
        device_id: metadata?.deviceId,
        device_name: metadata?.deviceName,
        device_type: metadata?.deviceType,
        os: metadata?.os,
        app_version: metadata?.appVersion,
        ip_address: metadata?.ipAddress,
        user_agent: metadata?.userAgent,
        expires_at: expiresAt,
        last_used_at: new Date(),
      },
    });

    return {
      refreshToken: this.formatRefreshToken(session.id, refreshSecret),
      session,
    };
  }

  async generateTokenPair(
    user: TokenUser,
    metadata?: SessionMetadata,
  ): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(user);
    const { refreshToken } = await this.generateRefreshToken(user, metadata);
    return { accessToken, refreshToken };
  }

  async validateRefreshToken(
    refreshToken: string,
    options: { detectReuse?: boolean; metadata?: SessionMetadata } = {
      detectReuse: true,
    },
  ): Promise<ValidatedRefreshToken> {
    const { sessionId, rawSecret } = this.parseRefreshToken(refreshToken);

    const session = await this.prisma.auth_sessions.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const isHashValid = await compareHash(rawSecret, session.refresh_token_hash);
    if (!isHashValid) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (isSessionExpired(session)) {
      await this.markSessionRevoked(session.id, {
        reason: 'expired',
      });
      throw new UnauthorizedException('Refresh token has expired');
    }

    if (isSessionRevoked(session)) {
      if (options.detectReuse) {
        await this.handleTokenReuse(session.user_id, options.metadata);
        throw new UnauthorizedException(
          'Suspicious activity detected. All sessions have been revoked. Please login again.',
        );
      }
      throw new UnauthorizedException(
        'Refresh token has been revoked. Please login again.',
      );
    }

    const user = await this.findActiveUser(session.user_id);
    if (!user) {
      throw new UnauthorizedException('User account is not active');
    }

    await this.prisma.auth_sessions.update({
      where: { id: session.id },
      data: { last_used_at: new Date() },
    });

    return { session, user, rawSecret };
  }

  async rotateRefreshToken(
    refreshToken: string,
    metadata?: SessionMetadata,
  ): Promise<TokenPair> {
    const { session, user } = await this.validateRefreshToken(refreshToken, {
      detectReuse: true,
      metadata,
    });

    const accessToken = this.generateAccessToken(user);
    const { refreshToken: newRefreshToken, session: newSession } =
      await this.generateRefreshToken(user, metadata);

    await this.markSessionRevoked(session.id, {
      replacedBySessionId: newSession.id,
      revokedByIp: metadata?.ipAddress,
      reason: 'rotation',
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async revokeRefreshToken(
    refreshToken: string,
    options?: RevokeSessionOptions,
  ): Promise<void> {
    const { sessionId, rawSecret } = this.parseRefreshToken(refreshToken);

    const session = await this.prisma.auth_sessions.findUnique({
      where: { id: sessionId },
    });

    if (!session || !session.is_active) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isHashValid = await compareHash(rawSecret, session.refresh_token_hash);
    if (!isHashValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.markSessionRevoked(session.id, {
      ...options,
      reason: options?.reason ?? 'logout',
    });
  }

  async revokeAllUserSessions(
    userId: string,
    options?: RevokeSessionOptions,
  ): Promise<{ revokedCount: number }> {
    const now = new Date();

    const result = await this.prisma.auth_sessions.updateMany({
      where: {
        user_id: userId,
        is_active: true,
        revoked_at: null,
      },
      data: {
        is_active: false,
        revoked_at: now,
        revoked_by_ip: options?.revokedByIp,
        revoke_reason: options?.reason ?? 'logout_all',
      },
    });

    return { revokedCount: result.count };
  }

  async getActiveSessions(userId: string) {
    const sessions = await this.prisma.auth_sessions.findMany({
      where: {
        user_id: userId,
        is_active: true,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { last_used_at: 'desc' },
      select: {
        id: true,
        device_id: true,
        device_name: true,
        device_type: true,
        os: true,
        ip_address: true,
        user_agent: true,
        expires_at: true,
        last_used_at: true,
        created_at: true,
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceId: session.device_id,
      deviceName: session.device_name,
      deviceType: session.device_type,
      os: session.os,
      ipAddress: session.ip_address,
      userAgent: session.user_agent,
      expiresAt: session.expires_at,
      lastUsedAt: session.last_used_at,
      createdAt: session.created_at,
      isActive: isSessionActive(session as auth_sessions),
      isExpired: isSessionExpired(session as auth_sessions),
      isRevoked: false,
    }));
  }

  private async handleTokenReuse(
    userId: string,
    metadata?: SessionMetadata,
  ): Promise<void> {
    await this.revokeAllUserSessions(userId, {
      revokedByIp: metadata?.ipAddress,
      reason: 'reuse_detected',
    });
  }

  private async markSessionRevoked(
    sessionId: string,
    options?: RevokeSessionOptions,
  ): Promise<void> {
    await this.prisma.auth_sessions.update({
      where: { id: sessionId },
      data: {
        is_active: false,
        revoked_at: new Date(),
        revoked_by_ip: options?.revokedByIp,
        replaced_by_session_id: options?.replacedBySessionId,
        revoke_reason: options?.reason,
      },
    });
  }

  private async findActiveUser(userId: string): Promise<users | null> {
    return this.prisma.users.findFirst({
      where: {
        id: userId,
        deleted_at: null,
        status: { notIn: ['SUSPENDED', 'BANNED', 'INACTIVE'] },
      },
    });
  }

  private getRefreshTokenExpiryDate(): Date {
    const refreshDays = parseDurationToDays(
      this.configService.get<string>('app.jwt.refreshExpiresIn')!,
    );
    return addDays(new Date(), refreshDays);
  }

  private async hashRefreshSecret(secret: string): Promise<string> {
    return hashValue(
      secret,
      this.configService.get<number>('app.bcryptRounds')!,
    );
  }

  private formatRefreshToken(sessionId: string, secret: string): string {
    return `${sessionId}.${secret}`;
  }

  private parseRefreshToken(refreshToken: string): {
    sessionId: string;
    rawSecret: string;
  } {
    const separatorIndex = refreshToken.indexOf('.');
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const sessionId = refreshToken.slice(0, separatorIndex);
    const rawSecret = refreshToken.slice(separatorIndex + 1);

    if (!sessionId || !rawSecret) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    return { sessionId, rawSecret };
  }
}
