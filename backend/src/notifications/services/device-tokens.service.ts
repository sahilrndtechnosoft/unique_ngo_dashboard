import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDeviceTokenDto } from '../dto/device-token.dto';

@Injectable()
export class DeviceTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async registerToken(userId: string, dto: RegisterDeviceTokenDto) {
    const platform = dto.platform.trim().toUpperCase();
    const deviceId = dto.deviceId?.trim() || dto.token;
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.device_tokens.upsert({
        where: { user_id_device_id_platform: { user_id: userId, device_id: deviceId, platform } },
        update: { token: dto.token, is_active: true, updated_at: now },
        create: { user_id: userId, token: dto.token, platform, device_id: deviceId, updated_at: now },
      }),
      this.prisma.device_tokens.updateMany({
        where: { user_id: userId, device_id: deviceId, token: { not: dto.token } },
        data: { is_active: false, updated_at: now },
      }),
      this.prisma.device_tokens.updateMany({
        where: { user_id: userId, token: dto.token, OR: [{ device_id: { not: deviceId } }, { platform: { not: platform } }] },
        data: { is_active: false, updated_at: now },
      }),
    ]);
  }

  async removeToken(userId: string, token: string) {
    const result = await this.prisma.device_tokens.updateMany({
      where: { user_id: userId, token },
      data: { is_active: false, updated_at: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Device token not found');
    }
  }

  async getActiveTokensForUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.device_tokens.findMany({
      where: { user_id: { in: userIds }, is_active: true },
      orderBy: { updated_at: 'desc' },
      select: { user_id: true, platform: true, device_id: true, token: true },
    });
    const latestByDevice = new Map<string, string>();
    for (const row of rows) {
      const key = `${row.user_id}:${row.platform.toUpperCase()}:${row.device_id ?? row.token}`;
      if (!latestByDevice.has(key)) latestByDevice.set(key, row.token);
    }
    return [...new Set(latestByDevice.values())];
  }

  async deactivateTokens(tokens: string[]) {
    if (tokens.length === 0) {
      return;
    }
    await this.prisma.device_tokens.updateMany({
      where: { token: { in: tokens } },
      data: { is_active: false, updated_at: new Date() },
    });
  }
}
