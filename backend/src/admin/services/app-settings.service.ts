import { Injectable } from '@nestjs/common';
import { app_settings } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { deleteUploadedFile } from '../../common/utils/image-upload.util';
import { UpdateAppSettingsDto } from '../dto/update-app-settings.dto';

const SETTINGS_KEY = 'default';

@Injectable()
export class AppSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const settings = await this.ensureSettings();
    return this.toPublic(settings);
  }

  async getPublicSettings() {
    const settings = await this.ensureSettings();
    return {
      companyName: settings.company_name,
      tagline: settings.tagline,
      logoUrl: settings.logo_url,
      faviconUrl: settings.favicon_url,
      email: settings.email,
      phone: settings.phone,
      whatsapp: settings.whatsapp,
      addressLine1: settings.address_line1,
      addressLine2: settings.address_line2,
      city: settings.city,
      state: settings.state,
      postalCode: settings.postal_code,
      country: settings.country,
      websiteUrl: settings.website_url,
      facebookUrl: settings.facebook_url,
      instagramUrl: settings.instagram_url,
      twitterUrl: settings.twitter_url,
      linkedinUrl: settings.linkedin_url,
      youtubeUrl: settings.youtube_url,
      footerAbout: settings.footer_about,
      footerCopyright: settings.footer_copyright,
      footerExtraHtml: settings.footer_extra_html,
      supportHours: settings.support_hours,
    };
  }

  async updateSettings(dto: UpdateAppSettingsDto, updatedById?: string) {
    await this.ensureSettings();

    const updated = await this.prisma.app_settings.update({
      where: { key: SETTINGS_KEY },
      data: {
        ...(dto.companyName !== undefined && { company_name: dto.companyName }),
        ...(dto.tagline !== undefined && { tagline: dto.tagline }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.whatsapp !== undefined && { whatsapp: dto.whatsapp }),
        ...(dto.addressLine1 !== undefined && {
          address_line1: dto.addressLine1,
        }),
        ...(dto.addressLine2 !== undefined && {
          address_line2: dto.addressLine2,
        }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.postalCode !== undefined && { postal_code: dto.postalCode }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.websiteUrl !== undefined && { website_url: dto.websiteUrl }),
        ...(dto.facebookUrl !== undefined && {
          facebook_url: dto.facebookUrl,
        }),
        ...(dto.instagramUrl !== undefined && {
          instagram_url: dto.instagramUrl,
        }),
        ...(dto.twitterUrl !== undefined && { twitter_url: dto.twitterUrl }),
        ...(dto.linkedinUrl !== undefined && {
          linkedin_url: dto.linkedinUrl,
        }),
        ...(dto.youtubeUrl !== undefined && { youtube_url: dto.youtubeUrl }),
        ...(dto.footerAbout !== undefined && {
          footer_about: dto.footerAbout,
        }),
        ...(dto.footerCopyright !== undefined && {
          footer_copyright: dto.footerCopyright,
        }),
        ...(dto.footerExtraHtml !== undefined && {
          footer_extra_html: dto.footerExtraHtml,
        }),
        ...(dto.supportHours !== undefined && {
          support_hours: dto.supportHours,
        }),
        updated_by_id: updatedById,
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async updateLogo(logoPath: string, updatedById?: string) {
    const settings = await this.ensureSettings();
    deleteUploadedFile(settings.logo_url);

    const updated = await this.prisma.app_settings.update({
      where: { key: SETTINGS_KEY },
      data: {
        logo_url: logoPath,
        updated_by_id: updatedById,
        updated_at: new Date(),
      },
    });

    return { logoUrl: updated.logo_url };
  }

  async updateFavicon(faviconPath: string, updatedById?: string) {
    const settings = await this.ensureSettings();
    deleteUploadedFile(settings.favicon_url);

    const updated = await this.prisma.app_settings.update({
      where: { key: SETTINGS_KEY },
      data: {
        favicon_url: faviconPath,
        updated_by_id: updatedById,
        updated_at: new Date(),
      },
    });

    return { faviconUrl: updated.favicon_url };
  }

  private async ensureSettings(): Promise<app_settings> {
    const existing = await this.prisma.app_settings.findUnique({
      where: { key: SETTINGS_KEY },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.app_settings.create({
      data: {
        key: SETTINGS_KEY,
        company_name: 'Unique NGO',
        tagline: 'Healthcare and social donation platform',
        footer_copyright: '© Unique NGO. All rights reserved.',
        country: 'India',
      },
    });
  }

  private toPublic(settings: app_settings) {
    return {
      id: settings.id,
      companyName: settings.company_name,
      tagline: settings.tagline,
      logoUrl: settings.logo_url,
      faviconUrl: settings.favicon_url,
      email: settings.email,
      phone: settings.phone,
      whatsapp: settings.whatsapp,
      addressLine1: settings.address_line1,
      addressLine2: settings.address_line2,
      city: settings.city,
      state: settings.state,
      postalCode: settings.postal_code,
      country: settings.country,
      websiteUrl: settings.website_url,
      facebookUrl: settings.facebook_url,
      instagramUrl: settings.instagram_url,
      twitterUrl: settings.twitter_url,
      linkedinUrl: settings.linkedin_url,
      youtubeUrl: settings.youtube_url,
      footerAbout: settings.footer_about,
      footerCopyright: settings.footer_copyright,
      footerExtraHtml: settings.footer_extra_html,
      supportHours: settings.support_hours,
      updatedAt: settings.updated_at,
      createdAt: settings.created_at,
    };
  }
}
