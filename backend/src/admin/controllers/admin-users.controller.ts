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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  CreateAdminUserDto,
  ListUsersQueryDto,
  UpdateAdminUserDto,
} from '../dto/admin-user.dto';
import { AdminUsersService } from '../services/admin-users.service';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @RequirePermissions(AppModule.USERS, PermissionAction.VIEW)
  @ResponseMessage('Users fetched successfully')
  @ApiOperation({ summary: 'List users with filters and pagination' })
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.USERS, PermissionAction.VIEW)
  @ResponseMessage('User fetched successfully')
  @ApiOperation({ summary: 'Get user by ID' })
  getUser(@Param('id') id: string) {
    return this.adminUsersService.getUser(id);
  }

  @Post()
  @RequirePermissions(AppModule.USERS, PermissionAction.CREATE)
  @ResponseMessage('User created successfully')
  @ApiOperation({ summary: 'Create a user' })
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.adminUsersService.createUser(dto);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.USERS, PermissionAction.EDIT)
  @ResponseMessage('User updated successfully')
  @ApiOperation({ summary: 'Update a user' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.adminUsersService.updateUser(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.USERS, PermissionAction.DELETE)
  @ResponseMessage('User deleted successfully')
  @ApiOperation({ summary: 'Soft-delete a user' })
  deleteUser(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.adminUsersService.deleteUser(id, actor.sub);
  }
}
