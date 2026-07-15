import { Injectable, NotFoundException } from '@nestjs/common';
import { banner_images } from '../../../generated/prisma/client';
import { deleteUploadedFile } from '../../common/utils/image-upload.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateBannerDto,
  UpdateBannerDto,
} from '../dto/update-banner.dto';

@Injectable()
export class BannerImagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listBanners(activeOnly = false) {
    const banners = await this.prisma.banner_images.findMany({
      where: {
        deleted_at: null,
        ...(activeOnly ? { is_active: true } : {}),
      },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
    });

    return banners.map((banner) => this.toPublic(banner));
  }

  async createBanner(
    imagePath: string,
    dto: CreateBannerDto,
    createdById?: string,
  ) {
    const banner = await this.prisma.banner_images.create({
      data: {
        image_url: imagePath,
        title: dto.title,
        subtitle: dto.subtitle,
        link_url: dto.linkUrl,
        button_text: dto.buttonText,
        sort_order: dto.sortOrder ?? 0,
        is_active: dto.isActive ?? true,
        created_by_id: createdById,
      },
    });

    return this.toPublic(banner);
  }

  async updateBanner(bannerId: string, dto: UpdateBannerDto) {
    await this.findBannerOrThrow(bannerId);

    const updated = await this.prisma.banner_images.update({
      where: { id: bannerId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
        ...(dto.linkUrl !== undefined && { link_url: dto.linkUrl }),
        ...(dto.buttonText !== undefined && { button_text: dto.buttonText }),
        ...(dto.sortOrder !== undefined && { sort_order: dto.sortOrder }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async replaceBannerImage(bannerId: string, imagePath: string) {
    const banner = await this.findBannerOrThrow(bannerId);
    deleteUploadedFile(banner.image_url);

    const updated = await this.prisma.banner_images.update({
      where: { id: bannerId },
      data: {
        image_url: imagePath,
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async deleteBanner(bannerId: string) {
    const banner = await this.findBannerOrThrow(bannerId);
    deleteUploadedFile(banner.image_url);

    await this.prisma.banner_images.update({
      where: { id: bannerId },
      data: {
        deleted_at: new Date(),
        is_active: false,
        updated_at: new Date(),
      },
    });
  }

  private async findBannerOrThrow(bannerId: string): Promise<banner_images> {
    const banner = await this.prisma.banner_images.findFirst({
      where: { id: bannerId, deleted_at: null },
    });

    if (!banner) {
      throw new NotFoundException('Banner not found');
    }

    return banner;
  }

  private toPublic(banner: banner_images) {
    return {
      id: banner.id,
      title: banner.title,
      subtitle: banner.subtitle,
      imageUrl: banner.image_url,
      linkUrl: banner.link_url,
      buttonText: banner.button_text,
      sortOrder: banner.sort_order,
      isActive: banner.is_active,
      createdAt: banner.created_at,
      updatedAt: banner.updated_at,
    };
  }
}
