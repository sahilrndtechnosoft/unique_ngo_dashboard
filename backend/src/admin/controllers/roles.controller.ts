import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
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
import { AssignRolePermissionsDto } from '../dto/assign-role-permissions.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RolesService } from '../services/roles.service';

@ApiTags('Admin - Roles')
@ApiBearerAuth()
@Controller('admin/roles')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions(AppModule.ROLES, PermissionAction.VIEW)
  @ResponseMessage('Roles fetched successfully')
  @ApiOperation({ summary: 'List all roles with permissions' })
  listRoles() {
    return this.rolesService.listRoles();
  }

  @Get(':id')
  @RequirePermissions(AppModule.ROLES, PermissionAction.VIEW)
  @ResponseMessage('Role fetched successfully')
  @ApiOperation({ summary: 'Get role details' })
  getRole(@Param('id') id: string) {
    return this.rolesService.getRole(id);
  }

  @Post()
  @RequirePermissions(AppModule.ROLES, PermissionAction.CREATE)
  @ResponseMessage('Role created successfully')
  @ApiOperation({ summary: 'Create a new role' })
  createRole(@Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.ROLES, PermissionAction.EDIT)
  @ResponseMessage('Role updated successfully')
  @ApiOperation({ summary: 'Update role details and/or permissions' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.updateRole(id, dto);
  }

  @Put(':id/permissions')
  @RequirePermissions(AppModule.ROLES, PermissionAction.EDIT)
  @ResponseMessage('Role permissions updated successfully')
  @ApiOperation({ summary: 'Replace permissions assigned to a role' })
  assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignRolePermissionsDto,
  ) {
    return this.rolesService.assignPermissions(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.ROLES, PermissionAction.DELETE)
  @ResponseMessage('Role deleted successfully')
  @ApiOperation({ summary: 'Delete a custom role' })
  deleteRole(@Param('id') id: string) {
    return this.rolesService.deleteRole(id);
  }
}
