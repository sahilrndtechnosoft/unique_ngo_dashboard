import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

interface MailConfig {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null | undefined;

  constructor(private readonly configService: ConfigService) {}

  private getTransporter(): Transporter | null {
    if (this.transporter !== undefined) {
      return this.transporter;
    }

    const config = this.configService.get<MailConfig>('mail');
    if (!config?.host || !config.user || !config.pass) {
      this.logger.warn('SMTP credentials are not configured — email notifications are disabled.');
      this.transporter = null;
      return this.transporter;
    }

    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
    return this.transporter;
  }

  async sendMail(to: string[], subject: string, html: string): Promise<void> {
    if (to.length === 0) {
      return;
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      return;
    }

    const from = this.configService.get<MailConfig>('mail')?.from;
    try {
      await transporter.sendMail({ from, to, subject, html });
    } catch (error) {
      this.logger.error(`Failed to send email "${subject}" to ${to.join(', ')}`, error as Error);
    }
  }
}
