import { Module } from '@nestjs/common';
import { AdminSellersController } from './controllers/admin-sellers.controller';
import { AdminDashboardController } from './controllers/dashboard.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AppSettingsController } from './controllers/app-settings.controller';
import { BannerImagesController } from './controllers/banner-images.controller';
import {
  AdminCategoriesController,
  CategoriesController,
} from './controllers/categories.controller';
import { AdminOrdersController, SellerOrdersController } from './controllers/orders.controller';
import { PagesController } from './controllers/pages.controller';
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
import { AdminDashboardService } from './services/dashboard.service';
import { PagesService } from './services/pages.service';
import { PermissionsCatalogService } from './services/permissions-catalog.service';
import { ProductsService } from './services/products.service';
import { RbacModule } from './rbac.module';
import { RolesService } from './services/roles.service';
import { OrdersModule } from '../orders/orders.module';
import { ShiprocketService } from './services/shiprocket.service';
import { ShiprocketWebhookController } from './controllers/shiprocket-webhook.controller';

@Module({
  imports: [OrdersModule, RbacModule],
  controllers: [
    RolesController,
    PermissionsController,
    AppSettingsController,
    BannerImagesController,
    PagesController,
    PublicSettingsController,
    AdminUsersController,
    AdminDashboardController,
    AdminSellersController,
    AdminCategoriesController,
    CategoriesController,
    AdminProductsController,
    SellerProductsController,
    PublicProductsController,
    AdminOrdersController,
    SellerOrdersController,
    ShiprocketWebhookController,
  ],
  providers: [
    RolesService,
    PermissionsCatalogService,
    AppSettingsService,
    BannerImagesService,
    PagesService,
    AdminUsersService,
    AdminSellersService,
    CategoriesService,
    ProductsService,
    AdminOrdersService,
    AdminDashboardService,
    ShiprocketService,
  ],
  exports: [RbacModule, AppSettingsService, BannerImagesService],
})
export class AdminModule {}
