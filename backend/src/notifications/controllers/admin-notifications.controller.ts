import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, PermissionAction, UserRole } from '../../common/constants';
import { RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BroadcastByBloodGroupDto } from '../dto/broadcast.dto';
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
  broadcast(@Body() dto: BroadcastByBloodGroupDto) {
    return this.notificationsService.broadcastByBloodGroup(dto);
  }
}
