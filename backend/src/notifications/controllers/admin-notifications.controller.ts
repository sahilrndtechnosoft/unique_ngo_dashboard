import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AppModule, PermissionAction, UserRole } from '../../common/constants';
import { RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { buildUploadedFilePath, createImageUploadOptions } from '../../common/utils/image-upload.util';
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
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['BLOOD_GROUP', 'ALL_USERS', 'SPECIFIC_USERS'] },
        bloodGroups: { type: 'array', items: { type: 'string' } },
        userIds: { type: 'array', items: { type: 'string' } },
        title: { type: 'string' },
        body: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['target', 'title', 'body'],
    },
  })
  @UseInterceptors(FileInterceptor('file', createImageUploadOptions('notifications')))
  broadcast(@Body() dto: SendNotificationDto, @UploadedFile() file?: Express.Multer.File) {
    const imageUrl = file ? buildUploadedFilePath('notifications', file.filename) : undefined;
    return this.notificationsService.broadcast(dto, imageUrl);
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
