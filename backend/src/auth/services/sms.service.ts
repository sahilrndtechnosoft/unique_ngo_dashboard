import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendOtp(mobileNumber: string, otp: string): Promise<void> {
    this.logger.log(
      `[Mock SMS] OTP sent to +91${mobileNumber}: ${otp} (valid for 5 minutes)`,
    );
  }
}
