import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { otp_purpose } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  addMinutes,
  compareHash,
  generateOtp,
  hashValue,
  normalizeMobile,
} from '../../common/utils/crypto.util';
import { SmsService } from './sms.service';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
  ) {}

  async sendOtp(
    mobileNumber: string,
    purpose: otp_purpose,
  ): Promise<{ otp?: string }> {
    const mobile = normalizeMobile(mobileNumber);
    const now = new Date();
    const expiryMinutes = this.configService.get<number>('app.otpExpiryMinutes')!;
    const bcryptRounds = this.configService.get<number>('app.bcryptRounds')!;
    const exposeOtp = this.configService.get<boolean>('app.exposeOtpInResponse')!;

    const existingOtp = await this.prisma.otp_verifications.findFirst({
      where: {
        identifier: mobile,
        purpose,
        is_used: false,
        expires_at: { gt: now },
      },
      orderBy: { created_at: 'desc' },
    });

    let otp: string;

    if (existingOtp) {
      otp = generateOtp();
      const otpHash = await hashValue(otp, bcryptRounds);
      await this.prisma.otp_verifications.update({
        where: { id: existingOtp.id },
        data: {
          otp_hash: otpHash,
          attempts: 0,
          expires_at: addMinutes(now, expiryMinutes),
        },
      });
    } else {
      otp = generateOtp();
      const otpHash = await hashValue(otp, bcryptRounds);
      await this.prisma.otp_verifications.create({
        data: {
          identifier: mobile,
          purpose,
          otp_hash: otpHash,
          expires_at: addMinutes(now, expiryMinutes),
        },
      });
    }

    await this.smsService.sendOtp(mobile, otp);

    return exposeOtp ? { otp } : {};
  }

  async verifyOtp(
    mobileNumber: string,
    otp: string,
    purpose: otp_purpose,
  ): Promise<void> {
    const mobile = normalizeMobile(mobileNumber);
    const now = new Date();

    const record = await this.prisma.otp_verifications.findFirst({
      where: {
        identifier: mobile,
        purpose,
        is_used: false,
        expires_at: { gt: now },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('OTP expired or not found. Please request a new OTP.');
    }

    if (record.attempts >= record.max_attempts) {
      throw new BadRequestException(
        'Maximum OTP attempts exceeded. Please request a new OTP.',
      );
    }

    const isValid = await compareHash(otp, record.otp_hash);

    if (!isValid) {
      await this.prisma.otp_verifications.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.otp_verifications.update({
      where: { id: record.id },
      data: { is_used: true, verified_at: now },
    });
  }
}
