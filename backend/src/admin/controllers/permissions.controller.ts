import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AppModule,
  PermissionAction,
  UserRole,
} from '../../common/constants';
import {
  RequirePermissions,
  ResponseMessage,
  Roles,
} from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AssignUserRbacRoleDto } from '../dto/assign-user-rbac-role.dto';
import { PermissionsCatalogService } from '../services/permissions-catalog.service';
import { RolesService } from '../services/roles.service';

@ApiTags('Admin - Permissions')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
export class PermissionsController {
  constructor(
    private readonly permissionsCatalogService: PermissionsCatalogService,
    private readonly rolesService: RolesService,
  ) {}

  @Get('permissions')
  @RequirePermissions(AppModule.ROLES, PermissionAction.VIEW)
  @ResponseMessage('Permissions fetched successfully')
  @ApiOperation({ summary: 'List all module permissions (View/Create/Edit/Delete)' })
  listPermissions() {
    return this.permissionsCatalogService.listPermissions();
  }

  @Get('permissions/catalog')
  @RequirePermissions(AppModule.ROLES, PermissionAction.VIEW)
  @ResponseMessage('Permission catalog fetched successfully')
  @ApiOperation({ summary: 'Get permission matrix catalog for UI builders' })
  getCatalog() {
    return this.permissionsCatalogService.getCatalog();
  }

  @Patch('users/:userId/rbac-role')
  @RequirePermissions(AppModule.USERS, PermissionAction.EDIT)
  @ResponseMessage('User RBAC role assigned successfully')
  @ApiOperation({ summary: 'Assign or remove RBAC role for an admin user' })
  assignUserRole(
    @Param('userId') userId: string,
    @Body() dto: AssignUserRbacRoleDto,
  ) {
    return this.rolesService.assignRoleToUser(userId, dto.roleId);
  }
}
