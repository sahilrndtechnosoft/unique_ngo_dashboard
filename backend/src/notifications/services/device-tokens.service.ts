import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDeviceTokenDto } from '../dto/device-token.dto';

@Injectable()
export class DeviceTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async registerToken(userId: string, dto: RegisterDeviceTokenDto) {
    const deviceId = dto.deviceId ?? dto.token;
    await this.prisma.device_tokens.upsert({
      where: { user_id_device_id_platform: { user_id: userId, device_id: deviceId, platform: dto.platform } },
      update: { token: dto.token, is_active: true, updated_at: new Date() },
      create: { user_id: userId, token: dto.token, platform: dto.platform, device_id: deviceId },
    });
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
      select: { token: true },
    });
    return rows.map((row) => row.token);
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
