import { Module } from '@nestjs/common';
import { AdminSellersController } from './controllers/admin-sellers.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AppSettingsController } from './controllers/app-settings.controller';
import { BannerImagesController } from './controllers/banner-images.controller';
import {
  AdminCategoriesController,
  CategoriesController,
} from './controllers/categories.controller';
import { AdminOrdersController } from './controllers/orders.controller';
import { PermissionsController } from './controllers/permissions.controller';
import {
  AdminProductsController,
  SellerProductsController,
} from './controllers/products.controller';
import { PublicProductsController } from './controllers/public-products.controller';
import { PublicSettingsController } from './controllers/public-settings.controller';
import { RolesController } from './controllers/roles.controller';
import { AdminSellersService } from './services/admin-sellers.service';
import { AdminUsersService } from './services/admin-users.service';
import { AppSettingsService } from './services/app-settings.service';
import { BannerImagesService } from './services/banner-images.service';
import { CategoriesService } from './services/categories.service';
import { AdminOrdersService } from './services/orders.service';
import { PermissionsCatalogService } from './services/permissions-catalog.service';
import { ProductsService } from './services/products.service';
import { RbacService } from './services/rbac.service';
import { RolesService } from './services/roles.service';

@Module({
  controllers: [
    RolesController,
    PermissionsController,
    AppSettingsController,
    BannerImagesController,
    PublicSettingsController,
    AdminUsersController,
    AdminSellersController,
    AdminCategoriesController,
    CategoriesController,
    AdminProductsController,
    SellerProductsController,
    PublicProductsController,
    AdminOrdersController,
  ],
  providers: [
    RolesService,
    PermissionsCatalogService,
    RbacService,
    AppSettingsService,
    BannerImagesService,
    AdminUsersService,
    AdminSellersService,
    CategoriesService,
    ProductsService,
    AdminOrdersService,
  ],
  exports: [RbacService, AppSettingsService, BannerImagesService],
})
export class AdminModule {}
