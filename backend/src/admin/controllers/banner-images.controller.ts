import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AppModule,
  JwtPayload,
  PermissionAction,
  UserRole,
} from '../../common/constants';
import {
  CurrentUser,
  RequirePermissions,
  ResponseMessage,
  Roles,
} from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  buildUploadedFilePath,
  createImageUploadOptions,
} from '../../common/utils/image-upload.util';
import {
  CreateBannerDto,
  UpdateBannerDto,
} from '../dto/update-banner.dto';
import { BannerImagesService } from '../services/banner-images.service';

@ApiTags('Admin - Banners')
@ApiBearerAuth()
@Controller('admin/banners')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
export class BannerImagesController {
  constructor(private readonly bannerImagesService: BannerImagesService) {}

  @Get()
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.VIEW)
  @ResponseMessage('Banners fetched successfully')
  @ApiOperation({ summary: 'List all banner images' })
  listBanners() {
    return this.bannerImagesService.listBanners(false);
  }

  @Post()
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.CREATE)
  @ResponseMessage('Banner uploaded successfully')
  @ApiOperation({ summary: 'Upload a new banner image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        subtitle: { type: 'string' },
        linkUrl: { type: 'string' },
        buttonText: { type: 'string' },
        sortOrder: { type: 'integer' },
        isActive: { type: 'boolean' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('banners')))
  async createBanner(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateBannerDto,
  ) {
    if (!file) {
      throw new BadRequestException('Banner image file is required');
    }

    return this.bannerImagesService.createBanner(
      buildUploadedFilePath('banners', file.filename),
      dto,
      user.sub,
    );
  }

  @Patch(':id')
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.EDIT)
  @ResponseMessage('Banner updated successfully')
  @ApiOperation({ summary: 'Update banner metadata (title, link, order, etc.)' })
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannerImagesService.updateBanner(id, dto);
  }

  @Post(':id/image')
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.EDIT)
  @ResponseMessage('Banner image replaced successfully')
  @ApiOperation({ summary: 'Replace banner image file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('banners')))
  async replaceBannerImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Banner image file is required');
    }

    return this.bannerImagesService.replaceBannerImage(
      id,
      buildUploadedFilePath('banners', file.filename),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.SETTINGS, PermissionAction.DELETE)
  @ResponseMessage('Banner deleted successfully')
  @ApiOperation({ summary: 'Delete a banner image' })
  deleteBanner(@Param('id') id: string) {
    return this.bannerImagesService.deleteBanner(id);
  }
}
