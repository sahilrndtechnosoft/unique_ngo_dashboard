import { Injectable } from '@nestjs/common';
import { blood_bank_settings } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckEligibilityDto, UpdateEligibilitySettingsDto } from '../dto/eligibility.dto';

const SETTINGS_KEY = 'default';

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

@Injectable()
export class EligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    return this.toPublicSettings(await this.ensureSettings());
  }

  async updateSettings(dto: UpdateEligibilitySettingsDto, updatedById?: string) {
    await this.ensureSettings();

    const updated = await this.prisma.blood_bank_settings.update({
      where: { key: SETTINGS_KEY },
      data: {
        ...(dto.donationEligibilityMonths !== undefined && { donation_eligibility_months: dto.donationEligibilityMonths }),
        ...(dto.tattooEligibilityMonths !== undefined && { tattoo_eligibility_months: dto.tattooEligibilityMonths }),
        updated_by_id: updatedById,
        updated_at: new Date(),
      },
    });

    return this.toPublicSettings(updated);
  }

  /**
   * `useAccountHistory` controls whether a missing `lastDonationDate` falls back to the account's own
   * donation history. Must be disabled when checking eligibility for someone other than the account
   * holder (e.g. an appointment booked on behalf of a family member) — the account's history doesn't apply to them.
   */
  async checkEligibility(userId: string, dto: CheckEligibilityDto, options?: { useAccountHistory?: boolean }): Promise<EligibilityResult> {
    const settings = await this.ensureSettings();
    const reasons: string[] = [];

    let lastDonationDate: Date | null = dto.lastDonationDate ? new Date(dto.lastDonationDate) : null;
    if (!lastDonationDate && (options?.useAccountHistory ?? true)) {
      const user = await this.prisma.users.findUnique({ where: { id: userId }, select: { last_donation_date: true } });
      lastDonationDate = user?.last_donation_date ?? null;
    }

    if (lastDonationDate) {
      const eligibleFrom = addMonths(lastDonationDate, settings.donation_eligibility_months);
      if (new Date() < eligibleFrom) {
        reasons.push(
          `You must wait at least ${settings.donation_eligibility_months} month(s) since your last donation. You'll be eligible from ${eligibleFrom.toISOString().slice(0, 10)}.`,
        );
      }
    }

    if (dto.hadTattooRecently && dto.tattooDate) {
      const eligibleFrom = addMonths(new Date(dto.tattooDate), settings.tattoo_eligibility_months);
      if (new Date() < eligibleFrom) {
        reasons.push(
          `You must wait at least ${settings.tattoo_eligibility_months} month(s) after a tattoo before donating. You'll be eligible from ${eligibleFrom.toISOString().slice(0, 10)}.`,
        );
      }
    }

    return { eligible: reasons.length === 0, reasons };
  }

  private async ensureSettings(): Promise<blood_bank_settings> {
    const existing = await this.prisma.blood_bank_settings.findUnique({ where: { key: SETTINGS_KEY } });
    if (existing) {
      return existing;
    }
    return this.prisma.blood_bank_settings.create({ data: { key: SETTINGS_KEY } });
  }

  private toPublicSettings(settings: blood_bank_settings) {
    return {
      donationEligibilityMonths: settings.donation_eligibility_months,
      tattooEligibilityMonths: settings.tattoo_eligibility_months,
      updatedAt: settings.updated_at,
    };
  }
}
