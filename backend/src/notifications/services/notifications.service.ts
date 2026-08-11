import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { notification_type, notifications, Prisma, user_role } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationTarget, SendNotificationDto } from '../dto/broadcast.dto';
import { ListAdminNotificationsQueryDto, ListNotificationsQueryDto } from '../dto/notification.dto';
import { DeviceTokensService } from './device-tokens.service';
import { FcmService } from './fcm.service';
import { MailService } from './mail.service';

export interface SendNotificationInput {
  type: notification_type;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
    private readonly deviceTokensService: DeviceTokensService,
    private readonly mailService: MailService,
  ) {}

  /** Reusable entry point for other modules to push + persist a notification for one user. */
  async notifyUser(userId: string, input: SendNotificationInput) {
    const tokens = await this.deviceTokensService.getActiveTokensForUsers([userId]);

    let sentAt: Date | null = null;
    if (tokens.length > 0) {
      const { invalidTokens } = await this.fcmService.sendToTokens(tokens, {
        title: input.title,
        body: input.body,
        data: input.data,
      });
      if (invalidTokens.length > 0) {
        await this.deviceTokensService.deactivateTokens(invalidTokens);
      }
      sentAt = new Date();
    } else {
      this.logger.debug(`No active device tokens for user ${userId} — notification persisted without a push.`);
    }

    return this.prisma.notifications.create({
      data: {
        user_id: userId,
        type: input.type,
        channel: 'PUSH',
        title: input.title,
        body: input.body,
        data: input.data,
        sent_at: sentAt,
      },
    });
  }

  /** Reusable entry point for pushing + persisting the same notification to many users at once. */
  async notifyUsers(userIds: string[], input: SendNotificationInput): Promise<{ targeted: number; delivered: number }> {
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) {
      return { targeted: 0, delivered: 0 };
    }

    const tokenRows = await this.prisma.device_tokens.findMany({
      where: { user_id: { in: uniqueUserIds }, is_active: true },
      select: { user_id: true, token: true },
    });

    const tokensByUser = new Map<string, string[]>();
    for (const row of tokenRows) {
      const tokens = tokensByUser.get(row.user_id) ?? [];
      tokens.push(row.token);
      tokensByUser.set(row.user_id, tokens);
    }

    let deliveredTokens = new Set<string>();
    if (tokenRows.length > 0) {
      const { successTokens, invalidTokens } = await this.fcmService.sendToTokens(
        tokenRows.map((row) => row.token),
        { title: input.title, body: input.body, data: input.data },
      );
      deliveredTokens = new Set(successTokens);
      if (invalidTokens.length > 0) {
        await this.deviceTokensService.deactivateTokens(invalidTokens);
      }
    }

    const now = new Date();
    const rows = uniqueUserIds.map((userId) => {
      const delivered = (tokensByUser.get(userId) ?? []).some((token) => deliveredTokens.has(token));
      return {
        user_id: userId,
        type: input.type,
        channel: 'PUSH' as const,
        title: input.title,
        body: input.body,
        data: input.data,
        sent_at: delivered ? now : null,
      };
    });

    await this.prisma.notifications.createMany({ data: rows });

    return { targeted: uniqueUserIds.length, delivered: rows.filter((row) => row.sent_at !== null).length };
  }

  async broadcast(dto: SendNotificationDto) {
    let userIds: string[];
    let type: notification_type;

    if (dto.target === NotificationTarget.BLOOD_GROUP) {
      const users = await this.prisma.users.findMany({
        where: { blood_group: { in: dto.bloodGroups }, deleted_at: null },
        select: { id: true },
      });
      userIds = users.map((user) => user.id);
      type = 'BLOOD_REQUEST';
    } else if (dto.target === NotificationTarget.SPECIFIC_USERS) {
      userIds = dto.userIds ?? [];
      type = 'SYSTEM';
    } else {
      const users = await this.prisma.users.findMany({ where: { deleted_at: null }, select: { id: true } });
      userIds = users.map((user) => user.id);
      type = 'SYSTEM';
    }

    const result = await this.notifyUsers(userIds, { type, title: dto.title, body: dto.body });
    return { matchedUsers: userIds.length, ...result };
  }

  /** Reusable entry point for other modules to email every admin/super-admin about a critical event. */
  async notifyAdminsByEmail(subject: string, html: string) {
    const admins = await this.prisma.users.findMany({
      where: { role: { in: [user_role.ADMIN, user_role.SUPER_ADMIN] }, deleted_at: null, email: { not: null } },
      select: { email: true },
    });
    const emails = admins.map((admin) => admin.email).filter((email): email is string => !!email);
    await this.mailService.sendMail(emails, subject, html);
  }

  async listMyNotifications(userId: string, query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = { user_id: userId };
    const [total, rows] = await Promise.all([
      this.prisma.notifications.count({ where }),
      this.prisma.notifications.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      items: rows.map((row) => this.toPublic(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getMyNotification(userId: string, id: string) {
    const row = await this.prisma.notifications.findFirst({ where: { id, user_id: userId } });
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    return this.toPublic(row);
  }

  async deleteMyNotification(userId: string, id: string) {
    const row = await this.prisma.notifications.findFirst({ where: { id, user_id: userId } });
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    await this.prisma.notifications.delete({ where: { id } });
  }

  async adminList(query: ListAdminNotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.notificationsWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { body: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.notifications.count({ where }),
      this.prisma.notifications.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
    ]);

    const recipientsById = await this.getRecipientsById(rows.map((row) => row.user_id));

    return {
      items: rows.map((row) => this.toPublic(row, recipientsById.get(row.user_id))),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async adminGet(id: string) {
    const row = await this.prisma.notifications.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    const recipientsById = await this.getRecipientsById([row.user_id]);
    return this.toPublic(row, recipientsById.get(row.user_id));
  }

  async adminDelete(id: string) {
    const row = await this.prisma.notifications.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    await this.prisma.notifications.delete({ where: { id } });
  }

  private async getRecipientsById(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) {
      return new Map<string, { full_name: string; email: string | null }>();
    }
    const rows = await this.prisma.users.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, full_name: true, email: true },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toPublic(row: notifications, recipient?: { full_name: string; email: string | null }) {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data,
      isRead: row.is_read,
      sentAt: row.sent_at,
      createdAt: row.created_at,
      recipient: recipient ? { id: row.user_id, fullName: recipient.full_name, email: recipient.email } : undefined,
    };
  }
}
