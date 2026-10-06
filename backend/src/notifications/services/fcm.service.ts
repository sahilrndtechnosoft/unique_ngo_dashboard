import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging, MulticastMessage } from 'firebase-admin/messaging';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  successTokens: string[];
  invalidTokens: string[];
}

/** Tokens FCM reports as permanently dead — safe to deactivate rather than retry. */
const DEAD_TOKEN_ERROR_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
];
const FCM_MULTICAST_LIMIT = 500;

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private app: App | null | undefined;

  constructor(private readonly configService: ConfigService) {}

  private getApp(): App | null {
    if (this.app !== undefined) {
      return this.app;
    }

    const config = this.configService.get<{ projectId?: string; clientEmail?: string; privateKey?: string }>('firebase');
    if (!config?.projectId || !config.clientEmail || !config.privateKey) {
      this.logger.warn('Firebase credentials are not configured — push notifications are disabled.');
      this.app = null;
      return this.app;
    }

    this.app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: config.projectId,
          clientEmail: config.clientEmail,
          privateKey: config.privateKey,
        }),
      });
    return this.app;
  }

  private getMessagingClient(): Messaging | null {
    const app = this.getApp();
    return app ? getMessaging(app) : null;
  }

  async sendToTokens(tokens: string[], payload: PushPayload): Promise<PushResult> {
    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length === 0) {
      return { successTokens: [], invalidTokens: [] };
    }

    const messaging = this.getMessagingClient();
    if (!messaging) {
      return { successTokens: [], invalidTokens: [] };
    }

    const successTokens: string[] = [];
    const invalidTokens: string[] = [];
    for (let index = 0; index < uniqueTokens.length; index += FCM_MULTICAST_LIMIT) {
      const batch = uniqueTokens.slice(index, index + FCM_MULTICAST_LIMIT);
      const message: MulticastMessage = {
        tokens: batch,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      };

      const response = await messaging.sendEachForMulticast(message);
      response.responses.forEach((result, resultIndex) => {
        const token = batch[resultIndex];
        if (result.success) {
          successTokens.push(token);
          return;
        }
        if (result.error && DEAD_TOKEN_ERROR_CODES.includes(result.error.code)) {
          invalidTokens.push(token);
        } else {
          this.logger.error(`FCM send failed for token ${token}: ${result.error?.message}`);
        }
      });
    }

    return { successTokens, invalidTokens };
  }
}
