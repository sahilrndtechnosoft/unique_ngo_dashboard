import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, ResponseMessage } from '../../common/decorators';
import { ListBannersQueryDto } from '../dto/update-banner.dto';
import { AppSettingsService } from '../services/app-settings.service';
import { BannerImagesService } from '../services/banner-images.service';

@ApiTags('Public - Settings')
@Controller('public')
@Public()
export class PublicSettingsController {
  constructor(
    private readonly appSettingsService: AppSettingsService,
    private readonly bannerImagesService: BannerImagesService,
  ) {}

  @Get('settings')
  @ResponseMessage('Public settings fetched successfully')
  @ApiOperation({
    summary: 'Get public company details, logo, footer, and active banners',
  })
  async getPublicSettings() {
    const [settings, banners] = await Promise.all([
      this.appSettingsService.getPublicSettings(),
      this.bannerImagesService.listBanners(true),
    ]);

    return {
      ...settings,
      banners,
    };
  }

  @Get('banners')
  @ResponseMessage('Active banners fetched successfully')
  @ApiOperation({ summary: 'Get active banner images, optionally filtered by placement and slot' })
  getActiveBanners(@Query() query: ListBannersQueryDto) {
    return this.bannerImagesService.listBanners(true, query.placement, query.slot);
  }
}
