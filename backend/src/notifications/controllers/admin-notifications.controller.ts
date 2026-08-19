import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, PermissionAction, UserRole } from '../../common/constants';
import { RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SendNotificationDto } from '../dto/broadcast.dto';
import { ListAdminNotificationsQueryDto } from '../dto/notification.dto';
import { NotificationsService } from '../services/notifications.service';

@ApiTags('Admin - Notifications')
@ApiBearerAuth()
@Controller('admin/notifications')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('broadcast')
  @RequirePermissions(AppModule.NOTIFICATIONS, PermissionAction.CREATE)
  @ResponseMessage('Notification broadcast sent')
  broadcast(@Body() dto: SendNotificationDto) {
    return this.notificationsService.broadcast(dto);
  }

  @Get()
  @RequirePermissions(AppModule.NOTIFICATIONS, PermissionAction.VIEW)
  @ResponseMessage('Notifications fetched successfully')
  list(@Query() query: ListAdminNotificationsQueryDto) {
    return this.notificationsService.adminList(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.NOTIFICATIONS, PermissionAction.VIEW)
  @ResponseMessage('Notification fetched successfully')
  get(@Param('id') id: string) {
    return this.notificationsService.adminGet(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.NOTIFICATIONS, PermissionAction.DELETE)
  @ResponseMessage('Notification deleted successfully')
  delete(@Param('id') id: string) {
    return this.notificationsService.adminDelete(id);
  }
}
