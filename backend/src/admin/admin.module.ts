import { Module } from '@nestjs/common';
import { AppSettingsController } from './controllers/app-settings.controller';
import { BannerImagesController } from './controllers/banner-images.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { PublicSettingsController } from './controllers/public-settings.controller';
import { RolesController } from './controllers/roles.controller';
import { AppSettingsService } from './services/app-settings.service';
import { BannerImagesService } from './services/banner-images.service';
import { PermissionsCatalogService } from './services/permissions-catalog.service';
import { RbacService } from './services/rbac.service';
import { RolesService } from './services/roles.service';

@Module({
  controllers: [
    RolesController,
    PermissionsController,
    AppSettingsController,
    BannerImagesController,
    PublicSettingsController,
  ],
  providers: [
    RolesService,
    PermissionsCatalogService,
    RbacService,
    AppSettingsService,
    BannerImagesService,
  ],
  exports: [RbacService, AppSettingsService, BannerImagesService],
})
export class AdminModule {}
