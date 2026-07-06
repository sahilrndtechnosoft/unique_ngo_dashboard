import { Module } from '@nestjs/common';
import { PermissionsController } from './controllers/permissions.controller';
import { RolesController } from './controllers/roles.controller';
import { PermissionsCatalogService } from './services/permissions-catalog.service';
import { RbacService } from './services/rbac.service';
import { RolesService } from './services/roles.service';

@Module({
  controllers: [RolesController, PermissionsController],
  providers: [RolesService, PermissionsCatalogService, RbacService],
  exports: [RbacService],
})
export class AdminModule {}
