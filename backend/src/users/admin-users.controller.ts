import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtPayload, Permission } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions, ResponseMessage } from '../common/decorators';
import { AdminUsersService } from './admin-users.service';
import {
  AdminCreateUserDto,
  AdminUpdateUserDto,
  ListUsersQueryDto,
} from './dto/admin-user.dto';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @Permissions(Permission.USERS_READ)
  @ResponseMessage('Users fetched successfully')
  @ApiOperation({ summary: 'List all users (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':id')
  @Permissions(Permission.USERS_READ)
  @ResponseMessage('User fetched successfully')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsersService.getUserById(id);
  }

  @Post()
  @Permissions(Permission.USERS_CREATE)
  @ResponseMessage('User created successfully')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  createUser(
    @CurrentUser() actor: JwtPayload,
    @Body() dto: AdminCreateUserDto,
  ) {
    return this.adminUsersService.createUser(dto, actor.role);
  }

  @Patch(':id')
  @Permissions(Permission.USERS_UPDATE)
  @ResponseMessage('User updated successfully')
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiResponse({ status: 200, description: 'User updated' })
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.adminUsersService.updateUser(id, dto, actor.sub, actor.role);
  }

  @Delete(':id')
  @Permissions(Permission.USERS_DELETE)
  @ResponseMessage('User deleted successfully')
  @ApiOperation({ summary: 'Soft-delete user by ID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.adminUsersService.deleteUser(id, actor.sub, actor.role);
  }
}
